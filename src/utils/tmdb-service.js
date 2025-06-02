const axios = require('axios');

class TMDBService {
    constructor() {
        this.apiKey = process.env.TMDB_API_KEY;
        this.baseURL = 'https://api.themoviedb.org/3';
        this.imageBaseURL = 'https://image.tmdb.org/t/p/w500';
    }

    async getMovieDetails(tmdbId) {
        try {
            const response = await axios.get(`${this.baseURL}/movie/${tmdbId}`, {
                params: {
                    api_key: this.apiKey,
                    language: 'en-US',
                }
            });

            const movie = response.data;
            return {
                title: movie.title,
                overview: movie.overview,
                releaseDate: movie.release_date,
                releaseYear: new Date(movie.release_date).getFullYear(),
                posterPath: movie.poster_path ? `${this.imageBaseURL}${movie.poster_path}` : null,
                backdropPath: movie.backdrop_path ? `${this.imageBaseURL}${movie.backdrop_path}` : null,
                rating: movie.vote_average,
                voteCount: movie.vote_count,
                genres: movie.genres.map(genre => genre.name),
                runtime: movie.runtime
            };
        } catch (error) {
            console.error(`Error fetching movie details for TMDB ID ${tmdbId}:`, error.message);
            throw error;
        }
    }

    async searchMovies(query) {
        try {
            const response = await axios.get(`${this.baseURL}/search/movie`, {
                params: {
                    api_key: this.apiKey,
                    query: query,
                    language: 'en-US',
                    page: 1,
                }
            });

            return response.data.results.map(movie =>({
                id: movie.id,
                title: movie.title,
                releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
                posterPath: movie.poster_path ? `${this.imageBaseURL}${movie.poster_path}` : null,
                overview: movie.overview,
            }));
        } catch (error) {
            console.error(`Error searching movies with query "${query}":`, error.message);
            throw error;
        }
    }
}

module.exports = TMDBService;