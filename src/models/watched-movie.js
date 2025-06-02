const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const WatchedMovie = sequelize.define('WatchedMovie', {
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    movieId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Movies',
            key: 'id'
        }
    },
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'movieId']
        }
    ]
});

module.exports = WatchedMovie;