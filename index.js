const oauth = require('oauth')
const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')

const path = require('path')
const fs = require('fs')
const { promisify } = require('util')

dotenv.config()
const COOKIE_SECRET = process.env.npm_config_cookie_secret || process.env.COOKIE_SECRET
const TWITTER_CONSUMER_API_KEY = process.env.TWITTER_CONSUMER_API_KEY
const TWITTER_CONSUMER_API_SECRET = process.env.TWITTER_CONSUMER_API_SECRET

const TEMPLATE = fs.readFileSync(path.resolve(__dirname, 'client', 'template.html'), { encoding: 'utf8' })

const oauthConsumer = new oauth.OAuth(
    'https://twitter.com/oauth/request_token', 'https://twitter.com/oauth/access_token',
    TWITTER_CONSUMER_API_KEY, TWITTER_CONSUMER_API_SECRET,
    '1.0A', 'http://127.0.0.1:3000/twitter/callback', 'HMAC-SHA1')

main().catch(err => console.error(err.message, err))

async function main() {
    const app = express()
    app.use(cookieParser())
    app.use(session({ secret: COOKIE_SECRET || 'secret' }))
    app.use((req, res, next) => {
        res.session = req.session;
        next();
    });

    app.get('/', async (req, res, next) => {
        if (req.cookies && req.cookies.twitter_screen_name) {
            return res.send(TEMPLATE.replace('CONTENT', `
            <h1>Hello ${req.cookies.twitter_screen_name}</h1>
            <br>
            <a href="/twitter/logout">logout</a>
        `))
        }
        return next()
    })
    app.use(express.static(path.resolve(__dirname, 'client')))

    app.get('/twitter/logout', logout)
    function logout(req, res, next) {
        res.clearCookie('twitter_screen_name')
        req.session.destroy(() => res.redirect('/'))
    }

    app.get('/twitter/authenticate', twitter('authenticate'))
    app.get('/twitter/authorize', twitter('authorize'))
    function twitter(method = 'authorize') {
        return async (req, res) => {
            const { oauthRequestToken, oauthRequestTokenSecret } = await getOAuthRequestToken()

            req.session = req.session || {}
            req.session.oauthRequestToken = oauthRequestToken
            req.session.oauthRequestTokenSecret = oauthRequestTokenSecret

            const authorizationUrl = `https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`
            res.redirect(authorizationUrl)
        }
    }

    app.get('/twitter/callback', async (req, res) => {
        const { oauthRequestToken, oauthRequestTokenSecret } = req.session
        const { oauth_verifier: oauthVerifier } = req.query

        const { oauthAccessToken, oauthAccessTokenSecret, results } = await getOAuthAccessTokenWith({ oauthRequestToken, oauthRequestTokenSecret, oauthVerifier })
        req.session.oauthAccessToken = oauthAccessToken

        const { user_id: userId /*, screen_name */ } = results
        const user = await oauthGetUserById(userId, { oauthAccessToken, oauthAccessTokenSecret })

        req.session.twitter_screen_name = user.screen_name
        res.cookie('twitter_screen_name', user.screen_name, { maxAge: 900000, httpOnly: true })

        req.session.save(() => res.redirect('/'))
    })

    app.listen(3000, () => console.log('listening on http://127.0.0.1:3000'))
}


/** Twitter OAuth Helper Functions **/

async function oauthGetUserById(userId, { oauthAccessToken, oauthAccessTokenSecret } = {}) {
    return promisify(oauthConsumer.get.bind(oauthConsumer))(`https://api.twitter.com/1.1/users/show.json?user_id=${userId}`, oauthAccessToken, oauthAccessTokenSecret)
        .then(body => JSON.parse(body))
}

async function getOAuthAccessTokenWith({ oauthRequestToken, oauthRequestTokenSecret, oauthVerifier } = {}) {
    return new Promise((resolve, reject) => {
        oauthConsumer.getOAuthAccessToken(oauthRequestToken, oauthRequestTokenSecret, oauthVerifier, function (error, oauthAccessToken, oauthAccessTokenSecret, results) {
            return error
                ? reject(new Error('Error getting OAuth access token'))
                : resolve({ oauthAccessToken, oauthAccessTokenSecret, results })
        })
    })
}

async function getOAuthRequestToken() {
    return new Promise((resolve, reject) => {
        oauthConsumer.getOAuthRequestToken(function (error, oauthRequestToken, oauthRequestTokenSecret, results) {
            return error
                ? reject(new Error('Error getting OAuth request token'))
                : resolve({ oauthRequestToken, oauthRequestTokenSecret, results })
        })
    })
}