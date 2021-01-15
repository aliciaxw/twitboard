import React, { Component } from 'react';
import './App.css';

import MasonryLayout from 'react-masonry-layout';
import Card from './components/Card/Card';
import Navbar from './components/Navbar/Navbar';

class App extends Component {

  state = {
    perPage: 8,
    items: Array(16).fill()
  }

  loadItems = () => {
    this.setState({
      items: this.state.items.concat(Array(this.state.perPage).fill())
    });
  }

  sizes = [
    { columns: 4, gutter: 5 }
  ]

  render() {
    return (
      <div className='app'>
        <div><Navbar /></div>
        <div className='content'>
          <MasonryLayout id='gallery' infiniteScroll={this.loadItems} sizes={this.sizes}>
          {this.state.items.map((v, i) => {
            return <Card />
          })}
          </MasonryLayout>
        </div>
      </div>
    );
  }
}

export default App;
