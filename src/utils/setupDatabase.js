require('dotenv').config();
const sequelize = require('./database');
const Movie = require('../models/movie');
const UserProgress = require('../models/user-progress');
const WatchedMovie = require('../models/watched-movie');
const fs = require('fs');
const path = require('path');

// Define associations
UserProgress.belongsTo(Movie, { 
    foreignKey: 'currentMovieId', 
    as: 'currentMovie',
    onDelete: 'SET NULL'
});

WatchedMovie.belongsTo(Movie, { 
    foreignKey: 'movieId',
    as: 'movie',
    onDelete: 'CASCADE'
});

Movie.hasMany(WatchedMovie, { 
    foreignKey: 'movieId',
    as: 'watchedByUsers'
});

async function setupDatabase() {
    try {
        console.log('🔧 Setting up database...');
        
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');

        // Sync models (create tables)
        await sequelize.sync({ force: false }); // Set to true to recreate tables
        console.log('✅ Database tables synchronized.');

        // Check if movies already exist
        const movieCount = await Movie.count();
        
        if (movieCount === 0) {
            console.log('📚 Seeding MCU movies...');
            await seedMovies();
            console.log('✅ MCU movies seeded successfully.');
        } else {
            console.log(`ℹ️  Database already contains ${movieCount} movies. Skipping seed.`);
        }

        console.log('🎉 Database setup complete!');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error);
        throw error;
    }
}

async function seedMovies() {
    try {
        // Read the MCU movies JSON file
        const moviesPath = path.join(__dirname, '..', '..', 'assets', 'mcu-movies.json');
        const moviesData = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));
        
        // Insert movies into database
        for (const movieData of moviesData.movies) {
            await Movie.create({
                title: movieData.title,
                tmdbId: movieData.tmdbId,
                releaseYear: movieData.releaseYear,
                order: movieData.order,
                phase: movieData.phase || null,
                description: null // Will be fetched from TMDB when needed
            });
            
            console.log(`  ✓ Added: ${movieData.title}`);
        }
        
        console.log(`📊 Seeded ${moviesData.movies.length} movies.`);
        
    } catch (error) {
        console.error('❌ Error seeding movies:', error);
        throw error;
    }
}

// Function to reset database (useful for development)
async function resetDatabase() {
    try {
        console.log('⚠️  Resetting database...');
        
        await sequelize.sync({ force: true });
        console.log('✅ Database reset complete.');
        
        await seedMovies();
        console.log('✅ Database reseeded.');
        
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        throw error;
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--reset')) {
        resetDatabase()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    } else {
        setupDatabase()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    }
}

module.exports = { setupDatabase, resetDatabase };