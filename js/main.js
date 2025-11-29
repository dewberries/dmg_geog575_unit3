//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    var width = 1200,
    height = 700;

    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height)

    var mapRect = map.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#061023")

    var projection = d3.geoAlbersUsa()
        .scale(1400)                
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("data/2024StateGovernmentTaxDataset.csv"));         
    promises.push(d3.json("data/US_States.topojson"));    
    Promise.all(promises).then(callback);

    function callback(data){

        var usStates = topojson.feature(data[1], data[1].objects.US_States).features;

        var states = map.selectAll(".states")
            .data(usStates)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.name;
            })
            .attr("d", path);
    }

    var title = map.append("text")
    .attr("class", "title")
    .attr("text-anchor", "middle")
    .attr("x", 600)
    .attr("y", 30)
    .text("2024 U.S. State Government Taxes");
}