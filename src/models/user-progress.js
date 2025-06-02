const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const UserProgress = sequelize.define('UserProgress', {
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    currentMovieId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Movies',
            key: 'id'
        }
    },
});

module.exports = UserProgress;