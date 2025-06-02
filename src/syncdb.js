const sequelize = require('./utils/database');
const { Movie, UserProgress, WatchedMovie } = require('./models');

sequelize.sync ({ alter: true })
.then(() => {
    console.log('Database synchronized successfully.');
    process.exit();
})
.catch((error) => {
    console.error('Error synchronizing database:', error);
    process.exit(1);
});