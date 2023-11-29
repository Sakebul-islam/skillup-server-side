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
    const classesCollection = client.db('skillup').collection('classes');
    const paymentsCollection = client.db('skillup').collection('payments');

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

    // get user role
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // get all feedbacks from feedbacksCollection
    app.get('/feedbacks', async (req, res) => {
      const result = await feedbacksCollection.find().toArray();
      res.send(result);
    });

    // post teachers to teachersCollection
    app.post('/teachers', async (req, res) => {
      const teacherInfo = req.body;
      const result = await teachersCollection.insertOne(teacherInfo);
      res.send(result);
    });

    app.patch('/teachers/update-status/:email', async (req, res) => {
      try {
        const email = req.params.email;

        // Assuming you only want to update the status
        const updatedStatus = { status: 'pending' };

        const query = { email: email };
        const updateDoc = {
          $set: updatedStatus,
        };

        const result = await teachersCollection.updateOne(query, updateDoc);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // get all classes
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // get single user classes
    app.get('/classes/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const result = await classesCollection.find({ email }).toArray();
      res.send(result);
    });

    // get single class
    app.get('/classes/single/:id', async (req, res) => {
      const id = req.params.id;
      const result = await classesCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // add Classes
    app.post('/classes', async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.send(result);
    });

    // Delete a class
    app.delete('/classes/:id', async (req, res) => {
      try {
        const classId = req.params.id;

        // Validate if classId is a valid ObjectId
        if (!ObjectId.isValid(classId)) {
          return res.status(400).send('Invalid class ID');
        }

        const result = await classesCollection.deleteOne({
          _id: new ObjectId(classId),
        });

        if (result.deletedCount === 1) {
          res.send('Class deleted successfully');
        } else {
          res.status(404).send('Class not found');
        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Top 4 Teachers API
    app.get('/top-teachers', async (req, res) => {
      try {
        // Aggregate to get total enrollment per teacher
        const enrollmentClassesOfTeacher = await classesCollection
          .aggregate([
            {
              $group: {
                _id: '$email',
                totalEnrollment: { $sum: '$enroll' },
              },
            },
            { $sort: { totalEnrollment: -1 } },
            // { $limit: 4 }, // Comment out the limit for testing
          ])
          .toArray();

        // console.log('Aggregation Result:', enrollmentClassesOfTeacher);

        // Get teacher details based on email
        const topTeachers = await Promise.all(
          enrollmentClassesOfTeacher.map(async ({ _id, totalEnrollment }) => {
            const teacherDetails = await teachersCollection.findOne(
              { email: _id },
              { projection: { image: 1, name: 1, _id: 0 } }
            );
            return {
              image: teacherDetails.image,
              name: teacherDetails.name,
              totalEnrollment,
            };
          })
        );


        res.send(topTeachers);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // ------------------------------------------------
    //                 TEACHER APIs
    // ------------------------------------------------

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
            status: 'approve',
          })
          .toArray();
        const rejectedResult = await teachersCollection
          .find({
            email: email,
            status: 'reject',
          })
          .toArray();

        res.send({
          pending: pendingResult,
          approve: approvedResult,
          rejected: rejectedResult,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    // Add assignment to a class by ID
    app.post('/classes/add-assignment/:id', async (req, res) => {
      try {
        const classId = req.params.id;
        const assignmentInfo = req.body;

        // Validate if classId is a valid ObjectId
        if (!ObjectId.isValid(classId)) {
          return res.status(400).send('Invalid class ID');
        }

        // Assuming ClassesCollection is your MongoDB collection
        const result = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $push: assignmentInfo }
        );

        if (result.modifiedCount === 1) {
          res.send('Assignment added successfully');
        } else {
          res.status(404).send('Class not found');
        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });
    // ------------------------------------------------
    //                 ADMIN APIs
    // ------------------------------------------------

    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/profile', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        if (!email) {
          return res.status(400).send({ error: 'Email parameter is missing' });
        }

        const result = await usersCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ error: 'User not found' });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    app.put('/users/update/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.body;
        const query = { email: email };
        const options = { upsert: true };

        // Update user in usersCollection
        const updateUserDoc = {
          $set: {
            ...user,
          },
        };

        // Update user in teachersCollection if the role is 'teacher'
        if (user.role === 'teacher') {
          const updateTeacherDoc = {
            $set: {
              status: 'approve',
            },
          };
          await teachersCollection.updateOne(query, updateTeacherDoc, options);
        } else if (user.role === 'student') {
          // Update user in teachersCollection if the role is 'student'
          const updateTeacherDoc = {
            $set: {
              status: 'pending',
            },
          };
          await teachersCollection.updateOne(query, updateTeacherDoc, options);
        }

        const result = await usersCollection.updateOne(
          query,
          updateUserDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.get('/teachers/requests', verifyToken, async (req, res) => {
      try {
        const result = await teachersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    //  API endpoint to update the status of a teacher
    app.put('/teachers/update-status/:id', verifyToken, async (req, res) => {
      try {
        const teacherId = req.params.id;
        const newStatus = req.body.status;

        // Update the status in the database
        await teachersCollection.updateOne(
          { _id: new ObjectId(teacherId) },
          { $set: { status: newStatus } }
        );

        // Find the corresponding user using the teacher's email
        const teacher = await teachersCollection.findOne({
          _id: new ObjectId(teacherId),
        });
        const userEmail = teacher.email;

        // Update the user's role based on the new status
        if (newStatus === 'pending' || newStatus === 'reject') {
          await usersCollection.updateOne(
            { email: userEmail },
            { $set: { role: 'student' } }
          );
        } else if (newStatus === 'approve') {
          await usersCollection.updateOne(
            { email: userEmail },
            { $set: { role: 'teacher' } }
          );
        }

        res.send({ message: 'Status updated successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    // Update class status
    app.patch('/classes/update-status/:id', async (req, res) => {
      try {
        const classId = req.params.id;
        const { status } = req.body;

        // Assuming classesCollection is your MongoDB collection
        const result = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $set: { status: status } }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.patch('/classes/update/:id', async (req, res) => {
      try {
        const classId = req.params.id;
        const { updateData } = req.body;

        // Validate if classId is a valid ObjectId
        if (!ObjectId.isValid(classId)) {
          return res.status(400).send('Invalid class ID');
        }

        // Assuming classesCollection is your MongoDB collection
        const result = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $set: updateData }
        );

        if (result.modifiedCount === 1) {
          res.send('Class updated successfully');
        } else {
          res.status(404).send('Class not found');
        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });
    // ------------------------------------------------
    // generate client secret for paymentIntent
    // ------------------------------------------------
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = Math.ceil(parseFloat(price) * 100);
      console.log(amount);
      if (!price || amount < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: client_secret });
    });

    // save booking info in booking collection
    app.post('/payments/:id', verifyToken, async (req, res) => {
      try {
        const payment = req.body;
        const classId = req.params.id;

        // Assuming classesCollection is your MongoDB collection for classes
        const classResult = await classesCollection.findOne({
          _id: new ObjectId(classId),
        });

        if (!classResult) {
          return res.status(404).send('Class not found');
        }

        // Assuming enroll is a property in classesCollection
        const enrollCount = classResult.enroll || 0;

        // Update enroll count in classesCollection
        const updateResult = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $set: { enroll: enrollCount + 1 } }
        );

        if (updateResult.modifiedCount === 1) {
          // Insert payment record into paymentsCollection
          const paymentResult = await paymentsCollection.insertOne(payment);

          res.send(paymentResult);
        } else {
          res.status(500).send('Failed to update enroll count');
        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // ------------------------------------------------
    //               site overall stats
    // ------------------------------------------------
    // Total User, Total Approved Classes, Total Enrollment API
    app.get('/stats', async (req, res) => {
      try {
        // Assuming usersCollection is your MongoDB collection for users
        const totalUsers = await usersCollection.countDocuments();

        // Assuming classesCollection is your MongoDB collection for classes
        const totalClasses = await classesCollection.countDocuments({
          status: 'approve',
        });

        // Assuming enroll is a property in classesCollection
        const totalEnrollment = await classesCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalEnrollment: { $sum: '$enroll' },
              },
            },
          ])
          .toArray();

        const result = {
          totalUsers,
          totalClasses,
          totalEnrollment:
            totalEnrollment.length > 0 ? totalEnrollment[0].totalEnrollment : 0,
        };

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // ------------------------------------------------

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
