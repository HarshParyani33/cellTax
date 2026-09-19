import mongoose from 'mongoose';
import { CategoryRule } from '../models/categoryRule.model.js';
import connectDB from '../db/index.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const defaultRules = [
    { keyword: 'SALARY', category: 'Salary Income', confidence: 95 },
    { keyword: 'INTEREST', category: 'Income from Other Sources', confidence: 90 },
    { keyword: 'ZOMATO', category: 'Meals & Entertainment', confidence: 85 },
    { keyword: 'SWIGGY', category: 'Meals & Entertainment', confidence: 85 },
    { keyword: 'UBER', category: 'Travel', confidence: 85 },
    { keyword: 'OLA', category: 'Travel', confidence: 85 },
    { keyword: 'AWS', category: 'Software Subscriptions', confidence: 90 },
    { keyword: 'DIVIDEND', category: 'Income from Other Sources', confidence: 95 },
    { keyword: 'LIC', category: '80C Deduction (Life Insurance)', confidence: 95 },
];

const seedRules = async () => {
    try {
        await connectDB();
        console.log('Connected to DB. Clearing existing rules...');
        await CategoryRule.deleteMany({});
        
        console.log('Inserting default rules...');
        await CategoryRule.insertMany(defaultRules);
        
        console.log('Rules seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding rules:', error);
        process.exit(1);
    }
};

seedRules();
