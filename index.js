const express=require("express")
const app=express()
const cors=require("cors")
// const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require("dotenv").config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const port=process.env.PORT || 4000;

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pgeg54g.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection=client.db("SummerCampSchoolDB").collection("user")
    const classesCollection = client.db("SummerCampSchoolDB").collection("classes");
    const instructorsCollection=client.db("SummerCampSchoolDB").collection("instructors")
    const classCollection=client.db("SummerCampSchoolDB").collection("bookedClass")
    const paymentCollection=client.db("SummerCampSchoolDB").collection("payments")


    // app.post("/jwt", (req, res) => {
    //   const user = req.body;
    //   console.log(user)
    //   const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'})
    //   res.send({token})
    // });

//user collection
app.get("/user",async(req,res)=>{
  const result=await userCollection.find().toArray()
  res.send(result)
})
app.post("/user", async (req, res) => {
  const user = req.body;
  console.log(user)
  const query = { email: user.email };
  const existingUsers = await userCollection.findOne(query);
  console.log("existing users", existingUsers);
  if (existingUsers) {
    return res.json({ message: "user already exists" });
  }
  const result = await userCollection.insertOne(user);
  res.send(result);
});
app.delete("/user/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await userCollection.deleteOne(query);
  res.send(result);
});

//admin route
app.get("/user/admin/:email",async(req,res)=>{
  const email=req.params.email;
  console.log(email)
  const query={email:email}
  const user=await userCollection.findOne(query)
  const result={admin: user?.role==="admin"}
  console.log(result)
  res.send(result)
})
app.patch("/user/admin/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});

//instructor route
app.get("/user/instructor/:email",async(req,res)=>{
  const email=req.params.email;
  console.log(email)
  const query={email:email}
  const user=await userCollection.findOne(query)
  const result={instructor: user?.role==="instructor"}
  console.log(result)
  res.send(result)
})
app.patch("/user/instructor/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "instructor",
    },
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});

//classes collection
app.get("/classes",async(req,res)=>{
  const result=await classesCollection.find().toArray()
  res.send(result)
    
})
app.post("/classes", async(req,res)=>{
  const newClass=req.body
  const result=await classesCollection.insertOne(newClass)
  res.send(result)
})

//instructors collection
app.get("/instructors", async(req,res)=>{
  const result=await instructorsCollection.find().toArray()
  res.send(result)
})

//classCollection
app.get("/bookedClass", async (req, res) => {
  const email = req.query.email;
  console.log(email);
  const query = { email: email };
  const result = await classCollection.find(query).toArray();
  res.send(result);
});
app.post("/bookedClass", async (req, res) => {
  const item = req.body;
  console.log(item);
  const result = await classCollection.insertOne(item);
  res.send(result);
});
app.delete("/bookedClass/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await classCollection.deleteOne(query);
  res.send(result);
});

//create-payment-intent
app.post("/create-payment-intent",async(req,res)=>{
  const {price}= req.body
  const amount=parseInt(price*100)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ['card']
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
})

//payment related api
app.get("/payments", async (req, res) => {
  const email = req.query.email; 
  console.log(email);
  const query = { email: email };
  const result = await paymentCollection.find(query).toArray();
  res.send(result);
});


app.post("/payments", async (req, res) => {
  const payment = req.body;
  console.log(payment);
  const insertResult = await paymentCollection.insertOne(payment);

  const classId = payment.id; // Get the specific class ID
  const query = { _id: new ObjectId(classId) };
  const deleteResult = await classCollection.deleteOne(query);

  // Update available seats for the booked class
  if (payment.classes && payment.classes.length > 0) {
    const updateQuery = { _id: { $in: payment.classes.map((id) => new ObjectId(id)) } };
    const classUpdateResult = await classesCollection.updateMany(
      updateQuery,
      { $inc: { availableSeats: -1 } }
    );

    if (classUpdateResult.modifiedCount !== payment.classes.length) {
      res.status(500).send({ error: "Failed to update available seats" });
      return;
    }
  }

  res.send({ insertResult, deleteResult});
});
// Assuming you have a MongoDB collection named 'payments'

app.delete("/payments/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await paymentCollection.deleteOne(query);
  res.send(result);
});

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/",(req,res)=>{
res.send("The summer camp school server is running")
})
app.listen(port, ()=>{
    console.log(`The summer camp school server is running on port: ${port}`)
})

// const insertResult = await paymentCollection.insertOne(payment);
// const query = { _id: new ObjectId(payment.classId) }; // Access the specific class ID directly