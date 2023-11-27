const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_KEY}@cluster0.ltwp59m.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db('skillup').collection('users');
    const feedbacksCollection = client.db('skillup').collection('feedbacks');
    const teachersCollection = client.db('skillup').collection('teachers');

    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log('I need a new jwt', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15d',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true });
        console.log('Logout successful');
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // store user information
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get all feedbacks from feedbacksCollection
    app.get('/feedbacks', async (req, res) => {
      const result = await feedbacksCollection.find().toArray();
      res.send(result);
    });

    // ------------------------------------------------
    // TEACHER APIs
    // ------------------------------------------------
    // post teachers to teachersCollection
    app.post('/teachers', async (req, res) => {
      const teacherInfo = req.body;
      const result = await teachersCollection.insertOne(teacherInfo);
      res.send(result);
    });
    // get teachers in teachersCollection
    app.get('/teachers', async (req, res) => {
      const email = req.query.email;
      try {
        const pendingResult = await teachersCollection
          .find({
            email: email,
            status: 'pending',
          })
          .toArray();

        const approvedResult = await teachersCollection
          .find({
            email: email,
            status: 'approves',
          })
          .toArray();
        const rejectedResult = await teachersCollection
          .find({
            email: email,
            status: 'rejects',
          })
          .toArray();

        res.send({
          pending: pendingResult,
          approved: approvedResult,
          rejected: rejectedResult,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from SkillUP Server..');
});

app.listen(port, () => {
  console.log(`SkillUP is running on port ${port}`);
});
