import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import stateRoutes from './routes/state.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import { startScheduler } from './services/scheduler.service.js';

if(!process.env.JWT_SECRET){
  console.error('Missing JWT_SECRET in .env');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', stateRoutes);
app.use('/api', settingsRoutes);

// always revalidate HTML so deploys reach users immediately
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath){
    if(filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4321;
app.listen(PORT, () => {
  console.log('DO OR DIE running at http://localhost:' + PORT);
  startScheduler();
});