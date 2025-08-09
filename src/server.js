import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import walletRoutes from './routes/walletRoutes.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('GarmentNFT API is running');
});

app.use('/api', authRoutes);
app.use('/api/users', walletRoutes); 

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
