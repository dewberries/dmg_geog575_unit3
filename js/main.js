//wrap everything in a self-executing anonymous function
(function(){
    //pseudo-global variables
    var attrArray = [
        "statesabrv",
        "Alcoholic Beverages License",
        "Alcoholic Beverages Sales Tax",
        "Amusements License",
        "Amusements Sales Tax",
        "Corporation Net Income Taxes",
        "Corporations in General License",
        "Death and Gift Taxes",
        "Documentary and Stock Transfer Taxes",
        "General Sales and Gross Receipts Taxes",
        "Hunting and Fishing License",
        "Individual Income Taxes",
        "Insurance Premiums Sales Tax",
        "Motor Fuels Sales Tax",
        "Motor Vehicle Operators License",
        "Motor Vehicles License",
        "Occupation and Businesses License, NEC",
        "Other License Taxes",
        "Other Selective Sales and Gross Receipts Taxes",
        "Property Taxes",
        "Public Utilities License",
        "Public Utilities Sales Tax",
        "Severance Taxes",
        "Sports Betting Sales Tax",
        "Taxes, NEC",
        "Tobacco Products Sales Tax"
    ];
    //set the first attribute as the expressed attribute
    var expressed = attrArray[3];

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
        height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height)

        //add background rectangle
        var mapRect = map.append("rect")
            .attr("class", "background")
            .attr("width", width)
            .attr("height", height)

        //create Albers equal area conic projection centered on USA
        var projection = d3.geoAlbersUsa()
            .scale(width * .95)               
            .translate([width / 2, height / 2]);

        // create geoPath generator
        var path = d3.geoPath()
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [];
        promises.push(d3.csv("data/2024StateGovernmentTaxDataset.csv"));         
        promises.push(d3.json("data/US_States.topojson"));    
        Promise.all(promises).then(callback);

        //callback function
        function callback(data){

            //place gridded data into array
            var csvData  = data[0];
            var statesOutline = data[1];

            //translate topojson to geojson
            var usStates = topojson.feature(statesOutline, statesOutline.objects.US_States).features;

            //join csv data to geojson enumeration units
            joinData(usStates, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumberationUnits(usStates, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        }

        //add title to map
        var title = map.append("text")
        .attr("class", "title")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)   
        .attr("y", 30)
        .text("2024 U.S. State Government Taxes - " + expressed);
    }

    function joinData(usStates, csvData){
        var filteredData = csvData.filter(d => d.statesabrv !== "USA");

        //join csv data to geojson enumeration units
        for (var i = 0; i < filteredData.length; i++) {

            //get csv row
            var csvRow = filteredData[i];
            var csvPostal = csvRow.statesabrv;

            //loop through geojson regions to find correct region
            for (var j = 0; j < usStates.length; j++) {

                //get geojson region
                var geojsonProps = usStates[j].properties;
                var geojsonPostal = geojsonProps.postal;

                //match csv and geojson postal codes
                if (geojsonPostal === csvPostal) {

                    //assign all attributes and values
                    attrArray.forEach(function(attr) {

                        //get csv attribute value and convert to float
                        var val = parseFloat(csvRow[attr]);
                        //assign attribute and value to geojson properties
                        geojsonProps[attr] = val;
                    });
                }
            }
        }
    }

    //add enumeration units to the map
    function setEnumberationUnits(usStates, map, path, colorScale){
        // add states to map
        var states = map.selectAll(".states")
            .data(usStates)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.postal;
            })
            .attr("d", path)        
                .style("fill", function(d){            
                    var value = d.properties[expressed];            
                    if(value) {                
                        return colorScale(d.properties[expressed]);            
                    } else {                
                        return "rgba(0, 0, 0, 0)";            
                    }    
        });
    }

    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#F9F5E3",
            "#fad090ff",
            "#EF798A",
            "#D14081",
            "#7E2E84"
        ];

        var filteredData = data.filter(d => d.statesabrv !== "USA");

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<filteredData.length; i++){
            var val = parseFloat(filteredData[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        var filteredData = csvData.filter(d => d.statesabrv !== "USA");

        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 473,
            leftPadding = 45,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        var maxVal = d3.max(filteredData, d => +d[expressed]);

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([chartInnerHeight, 0]) 
            .domain([0, maxVal]); 

        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(filteredData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.statesabrv;
            })
            .attr("width", chartInnerWidth / filteredData.length - 1)
            .attr("x", function(d, i){
                return i * (chartInnerWidth / filteredData.length) + leftPadding;
            })
            .attr("y", d => topBottomPadding + yScale(+d[expressed]))
        .attr("height", d => chartInnerHeight - yScale(+d[expressed]))
            .style("fill", function(d){
                return colorScale(d[expressed]);
            });

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", chartWidth / 2)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " Tax by State in 2024");

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
};
})();