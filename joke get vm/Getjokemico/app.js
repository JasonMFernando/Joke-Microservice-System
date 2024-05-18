const express = require('express')
const app = express()
const axios = require('axios')
const path = require('path')

const SubmitPort = 3001
const GetJokePort = 4000
const GetSubmitHost =  'localhost'  
const GetJokeHost =  'localhost'

var database = require('./database');

app.use(express.static(__dirname))

app.get('/types', function(req, res, next) {
    database.query('SELECT * FROM joke_types', function(error, data){
        if (error) {
            // Handle error
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
        res.json(data);
    });      
});


app.get('/getJokesByType', (req, res) => {
    const type_id = req.query.type_id; // Assuming type_id is passed as a query parameter
  
    //const sql = `SELECT setup FROM jokes WHERE type_id = ?`;
    const sql = `SELECT setup, punchline FROM jokes WHERE type_id = ? ORDER BY RAND() LIMIT 1`;
    console.log(sql + " wrote");
    database.query(sql, [type_id], (error, results) => {
      if (error) {
        res.status(500).json({ error: 'An error occurred' });
      } else {
        res.json(results);
      }
    });
  });


app.get('/getJokesByTypeAndCount', (req, res) => {
    const { type, count } = req.query; // Assuming 'type' and 'count' are passed as query parameters
    
    // Validate the input parameters
    if (!type || !count || isNaN(parseInt(count))) {
        return res.status(400).json({ error: 'Invalid input parameters' });
    }

    const sql = `SELECT setup, punchline FROM jokes WHERE type_id = ? ORDER BY RAND() LIMIT ?`;
    database.query(sql, [type, count], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'An error occurred' });
        } else {
            res.json(results);
        }
    });
});



  app.get('/getRandomJoke', (req, res) => {
    const sql = `SELECT setup, punchline FROM jokes ORDER BY RAND() LIMIT 1`;
    database.query(sql, (error, results) => {
        if (error) {
            res.status(500).json({ error: 'An error occurred' });
        } else {
            res.json(results);
        }
    });
  });




app.listen(GetJokePort, () => console.log(`Listening on port ${GetJokePort}`))