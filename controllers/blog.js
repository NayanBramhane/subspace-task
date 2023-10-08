import axios from "axios";
import _ from "lodash";
import ErrorHandler from "../middlewares/error.js";

// const curlCommand = `curl --request GET --url https://intent-kit-16.hasura.app/api/rest/blogs --header 'x-hasura-admin-secret: 32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6'`;

// variable to refresh the memoize function
let cacheTimestamp = 0;

// 60 minutes x 60 seconds x 1000 milliseconds = 1 hour
// cache duration is in milliseconds, currently equals to 1 hour
const cacheDuration = 60 * 60 * 1000;

// function to refresh cache whenever cache duration is over
let cacheRefresh = (next) => {
  try {
    const now = Date.now();
    // Check if the cached result is still valid based on cacheDuration
    if (!(now - cacheTimestamp < cacheDuration)) {
      // Cache has expired, fetch new data and update the cache
      cacheTimestamp = now; // Update the cache resolver key, return milliseconds
      return;
    }
    return;
  } catch (error) {
    console.error(`cacheRefresh - Error Occurred :\n${error}`);
    return next(
      new ErrorHandler(
        `Looks like our third-party API is not working, try again later`,
        500
      )
    );
  }
};

// config for axios request
const options = {
  url: "https://intent-kit-16.hasura.app/api/rest/blogs",
  method: "GET",
  headers: {
    "x-hasura-admin-secret":
      "32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6",
  },
};

// function to call api
const fetchDataFromApi = _.memoize(async (updateCache, next) => {
  try {
    // variable to send the response to external variable
    let responseBody;
    // calling api
    await axios(options)
      .then((response) => {
        responseBody = response.data;
      })
      .catch((e) => {
        console.error("fetchDataFromApi - Error Occurred\n",e)
        return next(
          new ErrorHandler(
            `Looks like our third-party API is not working, try again later`,
            500
          )
        );
      });
    // returning response if any or returns undefined
    return responseBody;
  } catch (error) {
    console.error("fetchDataFromApi - Error Occurred\n",e)
    return next(
      new ErrorHandler(
        `Looks like our third-party API is not working, try again later`,
        500
      )
    );
  }
});


// function to analyze data
const analyzeData = _.memoize(async (updateCache, next) => {
  try {
    // calling third-party api
    const { blogs } = await fetchDataFromApi(cacheTimestamp, next); //destructuring blogs array from response
  
    // Calculate the total number of blogs fetched.
    const numberOfBlogs = _.size(blogs);
  
    // Find the blog with the longest title.
    const { title: longestBlogTitle } = _.maxBy(
      blogs,
      (blog) => blog.title.length
    );
  
    // Determine the number of blogs with titles containing the word "privacy."
    const blogsWithPrivacy = _.filter(blogs, (blog) =>
      _.includes(blog.title.toLowerCase(), "privacy")
    );
    const numberOfBlogsWithPrivacy = _.size(blogsWithPrivacy);
  
    // Create an array of unique blog titles (no duplicates).
    const blogsWithUniqueTitles = _.uniqBy(blogs, "title");
    const uniqueBlogTitles = _.map(blogsWithUniqueTitles, "title");
  
    const data = {
      numberOfBlogs,
      longestBlogTitle,
      numberOfBlogsWithPrivacy,
      uniqueBlogTitles,
    };
    return data;
  } catch (error) {
    console.error(`analyzeData - Error occurred :\n${error}`);
    return next(
      new ErrorHandler(
        `We are having problem with analyzing data, try again later`,
        500
      )
    );
  }
});

const blogSearchQuery = _.memoize(async (updateCache, query, next)=>{
  try {
    // calling third-party api
    const { blogs } = await fetchDataFromApi(cacheTimestamp, next); //destructuring blogs array from response
  
    // filtering blogs based on which title contains the query string
    const filteredBlogs = _.filter(blogs, ({ title }) => {
      return _.includes(title.toLowerCase(), query.toLowerCase());
    });
  
    // if there are no blogs with the specified query
    if (_.size(filteredBlogs) === 0)
      return next(new ErrorHandler(`Sorry there's nothing on ${query}`, 400));
  
    return filteredBlogs;
  } catch (error) {
    console.error(`blogSearchQuery - Error occurred :\n${error}`);
    return next(
      new ErrorHandler(
        `We are having problem with searching the string in blogs, try again later`,
        500
      )
    );
  }
})

export const blogAnalytics = async (req, res, next) => {
  try {
    // refreshing cache for every request.
    cacheRefresh(next);

    // storing analyzed data in data, passing cacheTimestamp to check if it's updated
    // if cacheTimestamp is update then this function will run
    const data = await analyzeData(cacheTimestamp, next);
    res.status(200).json(data);
  } catch (error) {
    console.error(`blogAnalytics - Error Occurred : \n${error}`)
    next(error);
  }
};

export const blogSearch = async (req, res, next) => {
  try {
    const { query } = req.query;
    // if query string is not sent on this route, send this error
    if (!query) return next(new ErrorHandler("Could't find query string", 400));

    // refreshing cache for every request.
    cacheRefresh(next);

    // calling this function which returns blogs with titles having query in them
    // passed in resolver, separate query and next
    const filteredBlogs = await blogSearchQuery(JSON.stringify([cacheTimestamp, query]),query, next);
    
    res.status(200).json(filteredBlogs);
  } catch (error) {
    console.error(`blogSearch - Error occurred :\n${error}`);
    next(error);
  }
};
