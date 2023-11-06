const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors({
    origin: [
        'http://localhost:5173',
    ],
    credentials: true
}))
app.use(express.json());
app.use(cookieParser());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.phi4gnz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middlewares
const logger = async (req, res, next) => {
    console.log('called', req.host, req.originalUrl);
    next();
}
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('token in middleware:', token);
    if (!token) {
        return res.status(401).send({ message: 'Not Authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // error
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'Unauthorized' })
        }
        // if token is valid, it'll be decoded
        console.log('value in token', decoded);
        req.user = decoded;
        next();
    })
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const elysiumDB = client.db('elysiumDB');
        const foodItemsCollection = elysiumDB.collection('foodItems');
        const purchaseItemsCollection = elysiumDB.collection('purchaseItems');
        const users = elysiumDB.collection('users');

        //auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            }).send({ success: true });
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out:', user);
            res.clearCookie('token', {
                maxAge: 0
            }).send({ success: true });
        })

        app.post('/user', async (req, res) => {
            const user = req.body;
            const result = await users.insertOne(user);
            res.send(result);
        })

        // 'All Food Items' related api
        app.get('/itemsCount', async (req, res) => {
            const count = await foodItemsCollection.estimatedDocumentCount();
            res.send({ count });
        })

        app.get('/all-items', async (req, res) => {
            const cursor = foodItemsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/food-menu', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const cursor = foodItemsCollection.find().skip(page * size).limit(size);
            const result = await cursor.toArray();
            console.log('items:', result);
            res.send(result);
        })

        app.get('/food-menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const options = {
                projection: {}
            }

            const result = await foodItemsCollection.findOne(query);
            res.send(result);
        })

        app.post('/purchase-item', async (req, res) => {
            const foodItem = req.body;
            const result = await purchaseItemsCollection.insertOne(foodItem);
            res.send(result);
        })

        app.post('/add-item', async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await foodItemsCollection.insertOne(item);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Elysium is running');
})

app.listen(port, () => {
    console.log(`Elysium server is running on port: ${port}`);
})