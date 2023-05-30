const bodyParser = require('body-parser');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const dbConfig = require('./src/config/dbconfig');
const {port,jwtSecretKey,saltRounds} = require('./src/config/config');

const app = express();
app.use(bodyParser.json());

const pool = new Pool(dbConfig);

// Limit Set for rate API
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 2, // Limit 2 requests per 15mins
  });
  app.use('/dish/rate', limiter);



//HEALTH CHECK
app.get('/', (req, res) => {
    res.send('Service is Alive :)');
  });


//CREATE TOKEN USING CORRECT username and pass PAIR
app.post('/auth', (req, res) => {
  const { username, password } = req.body;
  
  pool.query('SELECT * FROM users WHERE username = $1', [username], (error, result) => {
    if (error) {
      console.error('Error executing query', error);
      res.status(500).json({ error: 'Internal server error' });
    } else {
        
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid username OR Password!!' });
      } 
      else {
        
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (bcryptError, isMatch) => {
         
            if (bcryptError) {
            console.error('Error comparing passwords', bcryptError);
            res.status(500).json({ error: 'Internal server error' });
          } 
          else if (isMatch==false) {
            res.status(401).json({ error: 'Invalid username OR Password!!!' });
          } 
          else {
            
            const token = jwt.sign({ userId: user.id }, jwtSecretKey);   // JWT CREATED
            
            res.json({ token });
          }
        });
      }
    }
  });
});

// USES for authenticate user before any action
function authenticateToken(req, res, next) {

  const token = req.headers['authorization'].split(' ')[1];

  if (token) {
    jwt.verify(token, jwtSecretKey, function (jwtError, decoded)  {
      if (jwtError) {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        console.log("Decoded userid:" ,decoded.userId);
        req.userId = decoded.userId;
        next();
      }
    });
  } 
  else {
    res.status(401).json({ error: 'Missing token' });
  }
}


// USE FOR CREATE new DISH
app.post('/dishes', authenticateToken, (req, res) => {
    const { name, description, price } = req.body;
  
    pool.query(
      'insert into dishes (name, description, price) values ($1, $2, $3) returning id',
      [name, description, price],
      (error, result) => {
        if (error) {
          console.error('Error executing query', error);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          const dishId = result.rows[0].id;
          res.json({ id: dishId, name, description, price });
        }
      }
    );
  });
  
  // USE FOR FETCH ALL DISHES OF CLIENT ID
  app.get('/dishes', authenticateToken, (req, res) => {
    pool.query('select * from dishes', (error, result) => {
      if (error) {
        console.error('Error in query', error);
        res.status(500).json({ error: 'Internal server error' });
      } 
      else {
        const dishes = result.rows;
        res.json(dishes);
      }
    });
  });



  // USE FOR FETCH A DISH
app.get('/dishes/:id', authenticateToken, (req, res) => {
    const dishId = req.params.id;
    pool.query('select * from dishes where id = $1', [dishId], (error, result) => {
          if (error) {
            console.error('Error in query', error);
            res.status(500).json({ error: 'Internal server error' });
          } 
          else {
            if(result.rows.length===0){
                res.status(404).json({ error: 'Dish Not Present in DB' });
            }
            else{
                const dish = result.rows[0];
                res.json({ id: dish.id, name: dish.name, description: dish.description, price: dish.price });
            }
          }
        }
      );
});



// USE TO UPDATE DISH USING ID
app.put('/dishes/:id', authenticateToken, (req, res) => {
    const dishId = req.params.id;
    const { name, description, price } = req.body;
    console.error('data', req.body);

    pool.query('update dishes set name = $1, description = $2, price = $3 where id = $4 returning *', [name, description, price, dishId], (error, result) => {
      if (error) {
        console.error('Error in query', error);
        res.status(500).json({ error: 'Internal server error' });
      } 
      else {
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Dish Not Present in DB' });
        } 
        else {
          const updatedDish = result.rows[0];
          res.json({ Message: 'Below Dish Updated Sucessfully', data: updatedDish});
        }
      }
    });
  });
  
  // USE FOR DELETE ANY DISH WITH ID
  app.delete('/dishes/:id', authenticateToken, (req, res) => {

    const dishId = req.params.id;

      pool.query('delete from dishes where id = $1 returning *', [dishId], (error, result) => {

      if (error) {
        console.error('Error in query', error);
        res.status(500).json({ error: 'Internal server error' });
      } 
      else {
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Dish not found' });
        } 
        else {
          const deletedDish = result.rows[0];
          res.json({ Message: 'Below Dish Deleted Sucessfully', data: deletedDish});
        }
      }
    });
  });

//USE FOR CREATE NEW USER
app.post('/users', (req, res) => {
    const { username, password } = req.body;

    bcrypt.hash(password, saltRounds, (error, hashedPassword) => {
      if (error) {
        console.error('Error hashing password', error);
        res.status(500).json({ error: 'Internal server error' });
      } 
      else {      
        pool.query(
          'insert into users (username, password) VALUES ($1, $2) returning id',
          [username, hashedPassword],
          (error, result) => {
            if (error) {
              console.error('Error executing query', error);
              res.status(500).json({ error: 'Internal server error' });
            } else {
                res.status(500).json({Message : 'Created sucessfully' }); // User created successfully
            }
          }
        );
      }
    });
  });

  // USE FOR RATE any DISH
app.post('/dish/rate', authenticateToken, (req, res) => {
    const { did, rating } = req.body;
    pool.query(
      'insert into ratings (uid, did, rating) values ($1, $2, $3) returning id',
      [req.userId, did, rating], (error, result) => {
        if (error) {
          console.error('Error in query', error);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.status(200).json({Message: "Succesfully rated the dish"});
        }
      }
    );
  });

app.listen(port, () => {
    console.log('Server is running on port 3000');
  });