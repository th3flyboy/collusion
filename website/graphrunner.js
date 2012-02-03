var GraphRunner = (function(jQuery, d3) {
  function Runner(options) {
    var trackers = options.trackers;
    var SVG_WIDTH = options.width;
    var SVG_HEIGHT = options.height;

    var vis = d3.select("#chart")
      .append("svg:svg")
        .attr("width", SVG_WIDTH)
        .attr("height", SVG_HEIGHT);

    vis.append("svg:defs")
      .append("svg:marker")
        .attr("id", "Triangle")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 30)
        .attr("refY", 5)
        .attr("markerUnits", "strokeWidth")
        .attr("markerWidth", 4*2)
        .attr("markerHeight", 3*2)
        .attr("orient", "auto")
        .append("svg:path")
          .attr("d", "M 0 0 L 10 5 L 0 10 z");

    vis.append("svg:g").attr("class", "links");
    vis.append("svg:g").attr("class", "nodes");

    function setDomainLink(target, d) {
      target.removeClass("tracker").removeClass("site");
      if (d.trackerInfo) {
        var TRACKER_INFO = "http://www.privacychoice.org/companies/index/";
        var trackerId = d.trackerInfo.network_id;
        target.attr("href", TRACKER_INFO + trackerId);
        target.addClass("tracker");
      } else {
        target.attr("href", "http://" + d.name);
        target.addClass("site");
      }
    }

    function showDomainInfo(d) {
      var className = d.name.replace(/\./g, '-dot-');
      var info = $("#domain-infos").find("." + className);

      $("#domain-infos .info").hide();

      if (!info.length) {
        info = $("#templates .info").clone();
        info.addClass(className);
        info.find(".domain").text(d.name);
        var img = $('<img>');
        if (d.trackerInfo) {
          var TRACKER_LOGO = "http://images.privacychoice.org/images/network/";
          var trackerId = d.trackerInfo.network_id;
          info.find("h2.domain").empty();
          img.attr("src", TRACKER_LOGO + trackerId + ".jpg").addClass("tracker");
        } else
          img.attr("src", 'http://' + d.name + '/favicon.ico')
             .addClass("favicon");
        setDomainLink(info.find("a.domain"), d);
        info.find("h2.domain").prepend(img);
        img.error(function() { img.remove(); });
        $("#domain-infos").append(info);
      }
      var referrers = info.find(".referrers");
      var domains = findReferringDomains(d);
      if (domains.length) {
        var list = referrers.find("ul");
        list.empty();
        domains.forEach(function(d) {
          var item = $('<li><a></a></li>');
          setDomainLink(item.find("a").text(d.name), d);
          list.append(item);
        });
        referrers.show();
      } else {
        referrers.hide();
      }
      info.show();
    }

    function createNodes(nodes, force) {

      /* Represent each site as a node consisting of an svg group <g>
       * containing a <circle> and an <image>, where the image shows
       * the favicon; circle size shows number of links, color shows
       * type of site. */

      function getReferringLinkCount(d) {
        return selectReferringLinks(d)[0].length;
      }

      function radius(d) {
        var added = getReferringLinkCount(d) / 3;
        if (added > 7)
          added = 7;
        return 4 + added;
      }

      function selectArcs(d) {
        return vis.selectAll("line.to-" + d.index +
                             ",line.from-" + d.index);
      }

      var node = vis.select("g.nodes").selectAll("g.node")
          .data(nodes);

      node.transition()
          .duration(1000)
          .attr("r", radius);

      // For eadch node, create svg group <g> to hold circle, image, and title
      var gs = node.enter().append("svg:g")
          .attr("class", "node")
          .attr("transform", function(d) {
            // <g> doesn't take x or y attributes but it can be positioned with a transformation
            return "translate(" + d.x + "," + d.y + ")";
          })
          .on("mouseover", function(d) {
            /* On mouseover, make the node appear larger, pull it to front,
               and make the links black so they stand out from the crowd. */
            selectArcs(d).attr("marker-end", "url(#Triangle)").classed("bold", true);
            showDomainInfo(d);
            d3.select(this).attr("transform", function(d) {
              return "translate(" + d.x + "," + d.y + ") scale(2, 2)";
              });
            /* SVG z-index is determined by node order within DOM, so move the node
               to the end of its parent in order to bring it to the front: */
            this.parentNode.appendChild(this);
          })
          .on("mouseout", function(d) {
            /* Upon leaving, undo the changes made in mouseover */
            selectArcs(d).attr("marker-end", null).classed("bold", false);
            d3.select(this).attr("transform", function(d) {
              return "translate(" + d.x + "," + d.y + ")";
            });
          })
          .call(force.drag);

      gs.append("svg:circle")
          .attr("cx", "0")
          .attr("cy", "0")
          .attr("r", 12) // was radius
          .attr("class", function(d) {
              var categorization;
              if (d.wasVisited) {
                categorization = "visited";
              } else if (d.trackerInfo) {
                categorization = "tracker";
              } else {
                categorization = "site";
              }
              return "node " + categorization;
          });

      gs.append("svg:image")
          .attr("class", "node")
          .attr("width", "16")
          .attr("height", "16")
          .attr("x", "-8") // offset to make 16x16 favicon appear centered
          .attr("y", "-8")
          .attr("xlink:href", function(d) {return 'http://' + d.name + '/favicon.ico'; } );

      gs.append("svg:title")
          .text(function(d) { return d.name; });

      return node;
    }

    function createLinks(links) {
      var link = vis.select("g.links").selectAll("line.link")
          .data(links)
        .enter().append("svg:line")
          .attr("class", function(d) { return "link from-" + d.source.index +
                                       " to-" + d.target.index; })
          .style("stroke-width", 1)
          .attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      return link;
    }

    function draw(json) {
      var force = d3.layout.force()
          .charge(-500)
          .distance(120)
          .friction(0)
          .nodes(json.nodes)
          .links(json.links)
          .size([SVG_WIDTH, SVG_HEIGHT])
          .start();

      createLinks(json.links);
      createNodes(json.nodes, force);

      vis.style("opacity", 1e-6)
        .transition()
          .duration(1000)
          .style("opacity", 1);

      force.on("tick", function() {
         vis.selectAll("line.link").attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

         vis.selectAll("g.node").attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
         });
      });

      return {
        vis: vis,
        force: force
      };
    }

    function selectReferringLinks(d) {
      return vis.selectAll("line.to-" + d.index);
    }

    function findReferringDomains(d, list, domain) {
      if (!list) {
        list = [];
        domain = d.name;
      }

      selectReferringLinks(d).each(function(d) {
        if (list.indexOf(d.source) == -1 &&
            d.source.name != domain) {
          list.push(d.source);
          findReferringDomains(d.source, list, domain);
        }
      });

      return list;
    }

    function CollusionGraph(trackers) {
      var nodes = [];
      var links = [];
      var domainIds = {};

      function getNodeId(domain) {
        if (!(domain in domainIds)) {
          domainIds[domain] = nodes.length;
          var trackerInfo = null;
          for (var i = 0; i < trackers.length; i++)
            if (trackers[i].domain == domain) {
              trackerInfo = trackers[i];
              break;
            }
          nodes.push({
            name: domain,
            trackerInfo: trackerInfo
          });
        }
        return domainIds[domain];
      }

      function addLink(options) {
        var fromId = getNodeId(options.from);
        var toId = getNodeId(options.to);
        var link = vis.select("line.to-" + toId + ".from-" + fromId);
        if (!link[0][0])
          links.push({source: fromId, target: toId});
      }

      var drawing = draw({nodes: nodes, links: links});

      return {
        data: null,
        update: function(json) {
          this.data = json;
          drawing.force.stop();

          for (var domain in json)
            for (var referrer in json[domain].referrers)
              addLink({from: referrer, to: domain});

          for (var n = 0; n < nodes.length; n++) {
            nodes[n].wasVisited = json[nodes[n].name].visited;
          }

          drawing.force.nodes(nodes);
          drawing.force.links(links);
          drawing.force.start();
          createLinks(links);
          createNodes(nodes, drawing.force);
        }
      };
    }

    function makeBufferedGraphUpdate(graph) {
      var timeoutID = null;

      return function(json) {
        if (timeoutID !== null)
         clearTimeout(timeoutID);
        timeoutID = setTimeout(function() {
          timeoutID = null;

          // This is for debugging purposes only!
          self.lastJSON = json;

          graph.update(json);
        }, 250);
      };
    }

    var graph = CollusionGraph(trackers);

    var self = {
      graph: graph,
      width: SVG_WIDTH,
      height: SVG_HEIGHT,
      updateGraph: makeBufferedGraphUpdate(graph)
    };

    return self;
  }

  var GraphRunner = {
    Runner: Runner
  };

  return GraphRunner;
})(jQuery, d3);