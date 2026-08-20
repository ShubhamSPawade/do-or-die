import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from '../src/db.js';

const USERS = [
  { email: 'admin@doordie.app',  password: 'admin123',  name: 'Admin',  role: 'ADMIN' },
  { email: 'friend@doordie.app', password: 'friend123', name: 'Friend', role: 'USER' }
];

for(const u of USERS){
  const password_hash = await bcrypt.hash(u.password, 10);
  const { error } = await supabase
    .from('users')
    .upsert({ email: u.email, password_hash, name: u.name, role: u.role });
  if(error){
    console.error(`Failed to seed ${u.email}:`, error.message);
    process.exit(1);
  }
  console.log('Seeded', u.email);
}
console.log('Seed complete.');