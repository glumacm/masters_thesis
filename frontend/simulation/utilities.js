const convertObjectToBase64String = (
    data, // any
) => {
    return btoa(JSON.stringify(data))
} 

module.exports = {
    convertObjectToBase64String: convertObjectToBase64String,
}