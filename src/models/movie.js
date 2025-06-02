const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const Movie = sequelize.define('Movie', {
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tmdbId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
    },
    releaseYear: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: false,
    },
    phase: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    franchise: {
        type: DataTypes.STRING,
        allowNull: false,
    }
});

module.exports = Movie;