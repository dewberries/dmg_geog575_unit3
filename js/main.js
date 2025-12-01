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
    var expressed = attrArray[1];

    // Global Variables
    var globalChart;
    var globalSortedData;
    var globalYScale;
    var globalXScale;
    var globalColorScale;

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 800,
        leftPadding = 70,
        rightPadding = 2,
        topBottomPadding = 5,
        bottomPadding = 30,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding - bottomPadding,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //Map dimensions
    var mapWidth = window.innerWidth * 0.5;
    var mapHeight = 800;

    //begin script when window loads
    window.onload = setMap;

    //set up choropleth map
    function setMap(){

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        //add background rectangle
        map.append("rect")
            .attr("class", "background")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        //create Albers equal area conic projection centered on USA
        var projection = d3.geoAlbersUsa()
            .scale(mapWidth * 0.95)
            .translate([mapWidth / 2, mapHeight / 2]);

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

            //add dropdown menu
            createDropdown(csvData);

            //create Legend
            createLegend(map, colorScale, mapWidth, mapHeight);
        }

        //add title to map
        map.append("text")
            .attr("id", "mapTitle")
            .attr("class", "title")
            .attr("text-anchor", "middle")
            .attr("x", mapWidth / 2)
            .attr("y", mapHeight - 20)
            .text("2024 U.S. State Government Taxes - " + expressed);
    }

    function joinData(usStates, csvData){

        //join csv data to geojson enumeration units
        for (var i = 0; i < csvData.length; i++) {

            //get csv row
            var csvRow = csvData[i];
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
                        var raw = csvRow[attr];
                        // Only convert numeric fields
                        if (!isNaN(parseFloat(raw)) && isFinite(raw)) {
                            geojsonProps[attr] = parseFloat(raw);
                        } else {
                            geojsonProps[attr] = raw;
                        }
                    });
                }
            }
        }
    }

    //add enumeration units to the map
    function setEnumberationUnits(usStates, map, path, colorScale){
        // add states to map
        map.selectAll(".states")
            .data(usStates)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.postal;
            })
            .attr("d", path)
            .on("mouseover", function(event, d){
                highlight(d.properties);
            })
            .on("mouseout", function(event, d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel)
            .style("fill", function(d){
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#d4cbffff";
                }
            });

        map.selectAll(".states")
            .append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
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

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

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

        //return the color scale generator
        return colorScale;
    }

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        var sortedData = csvData.slice().sort(function(a, b){
            return b[expressed] - a[expressed];
        });

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set maximum value of expressed attribute
        var maxVal = d3.max(sortedData, function(d){ return +d[expressed]; });

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([chartInnerHeight, 0])
            .domain([0, maxVal]);

        //create horizontal axis labels
        var xScale = d3.scaleLinear()
            .domain([0, sortedData.length])
            .range([leftPadding, chartInnerWidth + leftPadding]);

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place y axis
        chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //place x axis
        chart.append("g")
            .attr("class", "x-axis")
            .attr("transform", "translate(0," + (chartInnerHeight + topBottomPadding) + ")")
            .call(
                d3.axisBottom(xScale)
                    .tickValues(sortedData.map(function(d, i){ return i; }))
                    .tickFormat(function(d, i){ return sortedData[i].statesabrv; })
            )
            .selectAll("text")
            .attr("transform", "rotate(-65)")
            .style("text-anchor", "end");

        //adjust tick lines
        chart.selectAll(".x-axis .tick line")
            .attr("x1", 10)
            .attr("x2", 10);

        //create a text element for the chart title
        chart.append("text")
            .attr("x", chartWidth / 2)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " Tax by State in 2024");

        // store globals for updateChart
        globalChart = chart;
        globalSortedData = sortedData;
        globalYScale = yScale;
        globalXScale = xScale;
        globalColorScale = colorScale;

        // initial draw
        updateChart();
    }

    function updateChart(){
        //set bars width
        var barWidth = chartInnerWidth / globalSortedData.length;

        //function to position bars
        function barX(i) {
            return leftPadding + i * barWidth;
        }

        //set bars for each state
        globalChart.selectAll(".bar")
            .data(globalSortedData)
            .join("rect")
            .attr("class", function(d){ return "bar " + d.statesabrv; })
            .attr("width", barWidth - 1)
            .attr("x", function(d, i){ return barX(i); })
            .attr("y", function(d){ return topBottomPadding + globalYScale(+d[expressed]); })
            .attr("height", function(d){ return chartInnerHeight - globalYScale(+d[expressed]); })
            .on("mouseover", function(event, d){
                highlight(d);
            })
            .on("mouseout", function(event, d){
                dehighlight(d);
            })
            .on("mousemove", moveLabel)
            .transition()
            .delay(function(d, i){
                return i * 20
            })
            .duration(500)
            .style("fill", function(d){
                var value = d[expressed];
                return value ? globalColorScale(value) : "#d4cbffff";
            });

        var chartTitle = d3.select(".chartTitle")
            .text(expressed + " by State in 2024");
    }

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData);
            });

        //add initial option
        dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", true)
            .text("Select Tax Type");

        var filterArray = attrArray.filter(function(d){ return d !== "statesabrv"; });

        //add attribute name options
        dropdown.selectAll("attrOptions")
            .data(filterArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d; })
            .text(function(d){ return d; });
    }

    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        d3.select("#mapTitle")
            .text("2024 U.S. State Government Taxes - " + expressed);

        //recreate the color scale and store globally
        globalColorScale = makeColorScale(csvData);

        //recolor enumeration units
        d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return globalColorScale(value);
                } else {
                    return "#d4cbffff";
                }
            });

        // recompute sorted data and y-scale for the new attribute
        globalSortedData = csvData.slice().sort(function(a, b){
            return b[expressed] - a[expressed];
        });

        // Update the maxVal,yscale,xscale
        var maxVal = d3.max(globalSortedData, function(d){ return +d[expressed]; });
        globalYScale.domain([0, maxVal]);
        globalXScale.domain([0, globalSortedData.length]);

        // update y-axis
        globalChart.select(".axis")
            .call(d3.axisLeft(globalYScale));

        // update x-axis
        globalChart.select(".x-axis")
            .call(
                d3.axisBottom(globalXScale)
                    .tickValues(globalSortedData.map(function(d, i){ return i; }))
                    .tickFormat(function(d, i){ return globalSortedData[i].statesabrv; })
            )
            .selectAll("text")
            .attr("transform", "rotate(-65)")
            .style("text-anchor", "end");

        // update bars
        updateChart();

        createLegend(d3.select(".map"), globalColorScale, mapWidth, mapHeight);
    }

    //Highlight Funciton
    function highlight(props){
        d3.selectAll("." + props.statesabrv)
            .raise()  
            .style("stroke", "yellow")
            .style("stroke-width", "3");
    
        setLabel(props);
    }

    //Dehiglight function
    function dehighlight(props){
        d3.selectAll("." + props.statesabrv)
            .style("stroke", null)
            .style("stroke-width", null);
        d3.select(".infolabel")
            .remove();
    }

    function setLabel(props){

        var money = d3.format("$,");

        //label content
        if (props[expressed]==0){
            var labelAttribute = "<h1>" + "No Data" +
            "</h1><b>" + props.name + "</b>";
        }
        else{
            var labelAttribute = "<h1>" + money(props[expressed]) +
            "</h1><b>" + props.name + "</b>";
        }

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.statesabrv + "_label")
            .html(labelAttribute);
    };

    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };


    function createLegend(map, colorScale, width, height) {

        map.selectAll(".legendGroup").remove();
    
        var legend = map.append("g")
            .attr("class", "legendGroup")
            .attr("transform", "translate(20," + (height - 190) + ")");
    
        legend.append("text")
            .attr("class", "legendTitle")
            .attr("x", 0)
            .attr("y", -10)  
            .text("Legend");
    
        var breaks = colorScale.domain();
        var colors = colorScale.range().slice();  
    
        // Build labels
        var labels = [];
        labels.push("≤ " + Math.round(breaks[0]));
        for (var i = 0; i < breaks.length - 1; i++) {
            labels.push(Math.round(breaks[i]) + " – " + Math.round(breaks[i+1]));
        }
        labels.push("≥ " + Math.round(breaks[breaks.length - 1]));
    
        colors.push("#d4cbffff");
        labels.push("No Data");
    
        var item = legend.selectAll(".legendItem")
            .data(colors)
            .enter()
            .append("g")
            .attr("class", "legendItem")
            .attr("transform", function(d, i){
                return "translate(0," + (i * 25) + ")";
            });
    
        item.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .style("fill", function(d){ return d; })
            .style("stroke", "#2b0397");
    
        item.append("text")
            .attr("x", 30)
            .attr("y", 15)
            .text(function(d, i){ return labels[i]; });
    }


})();
