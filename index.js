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
    await client.connect();
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


app.get("/classes",async(req,res)=>{
  const result=await classesCollection.find().toArray()
  res.send(result)
    
})
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
app.post("/payments",async (req, res) => {
  const payment = req.body;
  console.log(payment);
  const insertResult = await paymentCollection.insertOne(payment);
  const query = { _id: { $in: payment.selectedClass.map((id) => new ObjectId(id)) } };
  const deleteResult = await classCollection.deleteOne(query);

  // Update available seats for the booked class
  const updateQuery = { _id: { $in: payment.classes.map((id) => new ObjectId(id)) } };
  const classUpdateResult = await classesCollection.updateMany(
    updateQuery,
    { $inc: { availableSeats: -1 } }
  );

  if (classUpdateResult.modifiedCount === payment.classes.length) {
    res.send({ insertResult, deleteResult });
  } else {
    res.status(500).send({ error: "Failed to update available seats" });
  }
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