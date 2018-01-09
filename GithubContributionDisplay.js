var margin = {top: 40, right: 30, bottom: 0, left: 10};
var width = setWidth();
var height = 320;
var barHeight = 20;
var duration = 750;
var delay = 25;
var prevWidth;
var x;
var xAxis;
var svg; 
var queue;
var resizeTimer;
var color = d3.scale.ordinal().range(["limegreen", "steelblue"]);
var partition = d3.layout.partition().value(function(d) { return d.size; });

var API_HOME = "https://api.github.com";
var GIT_HUB_USER_NAME = "jung-kim";

var contributionDisplay = function() {
  d3.select("#contributions").select("svg").remove();
   x = d3.scale.linear()
      .range([0, width]);
   xAxis = d3.svg.axis()
    .scale(x)
    .tickFormat(d3.format("d"))
    .orient("top");
  queue = [];

  svg = d3.select("#contributions").append("svg")
    .attr("id", "graph")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewbox", "0 0 " + width + " " + height)
    .attr("preserveAspectRatio", "xMinYMid")
    .attr("style", "border-width: 5px; border-style: solid; border-radius: 5px;")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("rect")
      .attr("class", "background")
      .attr("fill", "white")
      .attr("width", width)
      .attr("height", height)
      .style("opacity", 0.7)
      .on("click", goUp);

  svg.append("g")
      .attr("class", "x axis");

  svg.append("g")
      .attr("class", "y axis")
    .append("line")
      .attr("y1", "100%");

  goDown();
};

// A stateful closure for stacking bars horizontally.
var stack = function(i) {
  var x0 = 0;
  return function(d) {
    var tx = "translate(" + x0 + "," + barHeight * i * 1.2 + ")";
    x0 += x(d.value);
    return tx;
  };
};

// Creates a set of bars for the given data node, at the specified index.
var bar = function(d) {
  var bar = svg.insert("g", ".y.axis")
      .attr("class", "enter")
      .attr("transform", "translate(0,5)")
    .selectAll("g")
      .data(d.children)
    .enter().append("g")
      .style("cursor", "pointer")
      .on("click", goDown);

  bar.append("rect")
      .attr("width", function(d) { return x(d.value); })
      .attr("height", barHeight);

  bar.append("text")
      .attr("x", 6)
      .attr("y", barHeight / 2)
      .attr("dy", ".35em")
      .text(function(d) { return d.name; });

  return bar;
};

var queryApi = function(url, callback, d, i) {
  $.getJSON(API_HOME + url)
    .done(function(data) {
      var translated = url.indexOf("/users") === 0 ? translateForUser(data) : translateForRepo(data);
      if (d) {
        d.children = translated.children;
        callback(d, i);
      } else {
        callback(translated);  
      }
    })
    .fail(function(jqXHR) {
      svg.append("foreignObject")
          .attr("width", "100%")
          .attr("height", "100%")
        .append("xhtml:body")
          .html(jqXHR.responseJSON.message);
    });
};

var getApiUrl = function(d) {
  var result;
  if (d) {
    var splited = d.name.split('/');

    if (splited.length == 2) {
      var user = splited[0];
      var repo = splited[1];

      result = "/repos/" + user + "/" + repo + "/events";
    } else {
      result = "/users/" + d.name + "/events";
    }
  } else {
    result = "/users/" + GIT_HUB_USER_NAME + "/events";
  }

  return result;
};

var translateForRepo = function(data) {
  var children = [];
  var tempChildren = [];
  var loopControl = Math.min(data.length, 15);
  for (var n = 0; n < loopControl; n++) {
    var child = tempChildren[data[n].actor.login];
    size = child ? ++child.size : 1;

    tempChildren[data[n].actor.login] = {"name": data[n].actor.login, "size": size};
  }
  for (var childName in tempChildren) {
    children.push(tempChildren[childName]);
  }
  return {"name": "data", "children" : children};
};

var translateForUser = function(data) {
  var children = [];
  var tempChildren = [];
  var loopControl = Math.min(data.length, 15);
  for (var n = 0; n < loopControl; n++) {
    var child = tempChildren[data[n].repo.name];
    size = child ? ++child.size : 1;

    tempChildren[data[n].repo.name] = {"name": data[n].repo.name, "size": size};
  }
  for (var childName in tempChildren) {
    children.push(tempChildren[childName]);
  }
  return {"name": "data", "children" : children};
};

var goUp = function(d, i) {
  if (queue.length > 1) {
    queue.pop();
    queryApi(queue[queue.length - 1], dig, d, i);
  }
};

var goDown = function(d, i) {
  var apiUrl = getApiUrl(d);
  queue.push(apiUrl);
  queryApi(apiUrl, dig, d, i);
};

var dig = function(d, i) {
  partition.nodes(d);
  x.domain([0, d.value]).nice();
  if (!d.children || this.__transition__) return;
  var end = duration + d.children.length * delay;

  // Mark any currently-displayed bars as exiting.
  var exit = svg.selectAll(".enter")
      .attr("class", "exit");

  // Entering nodes immediately obscure the clicked-on bar, so hide it.
  exit.selectAll("rect").filter(function(p) { return p === d; })
      .style("fill-opacity", 1e-6);

  // Enter the new bars for the clicked-on data.
  // Per above, entering bars are immediately visible.
  var enter = bar(d)
      .attr("transform", stack(i))
      .style("opacity", 1);

  // Have the text fade-in, even though the bars are visible.
  // Color the bars as parents; they will fade to children if appropriate.
  enter.select("text").style("fill-opacity", 1e-6);
  enter.select("rect").style("fill", color(true));

  // Update the x-scale domain.
  x.domain([0, d3.max(d.children, function(d) { return d.value; })]).nice();

  // Update the x-axis.
  svg.selectAll(".x.axis").transition()
      .duration(duration)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#3D3D3D");
  

  // Transition entering bars to their new position.
  var enterTransition = enter.transition()
      .duration(duration)
      .delay(function(d, i) { return i * delay; })
      .attr("transform", function(d, i) { return "translate(0," + barHeight * i * 1.2 + ")"; });

  // Transition entering text.
  enterTransition.select("text")
      .style("fill-opacity", 1);

  // Transition entering rects to the new x-scale.
  enterTransition.select("rect")
      .attr("width", function(d) { return x(d.value); })
      .style("fill", function(d) { return color(queue.length % 2); });

  // Transition exiting bars to fade out.
  var exitTransition = exit.transition()
      .duration(duration)
      .style("opacity", 1e-6)
      .remove();

  // Transition exiting bars to the new x-scale.
  exitTransition.selectAll("rect")
      .attr("width", function(d) { return x(d.value); });

  // Rebind the current node to the background.
  svg.select(".background")
      .datum(d)
    .transition()
      .duration(end);

  d.index = i;
};

function setWidth() {
  if ($(window).width() > 830) {
    return 720;
  } else if ($(window).width() < 310) {
    return 200;
  }else {
    return $(window).width() - 110;
  }
}

function refreshChart() {
  width = setWidth();

  if (prevWidth != width) {
    prevWidth = width;
    contributionDisplay();
  }
}

window.onresize = function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    refreshChart();
  }, 300);
}
