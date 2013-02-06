var vis = function(data) {

  var colors = [
    colorbrewer.YlGn[9],
    colorbrewer.GnBu[9],
    colorbrewer.BuPu[9],
    colorbrewer.PuRd[9],
    colorbrewer.YlOrBr[9]
  ];

  Date.prototype.format = (function() {
    var timeFormat = d3.time.format('%b %d %H:%M, %Y');
    return function() {
      return timeFormat(this);
    };
  })();

  Number.prototype.format = function() {
    if (this > 1000000) {
      return (Math.round(this / 100000) / 10) + 'M';
    } else if (this > 1000) {
      return (Math.round(this / 100) / 10) + 'K';
    } else {
      return this;
    }
  };

  // process data
  var data = (function() {
    data.statuses.values.forEach(function(d) {
      d.sentiment = Math.random();  // random sentiment...
    });

    data.statuses.byTopic = d3.nest()
      .key(function(d) {
        return d.topic;
      })
      .entries(data.statuses.values);

    data.provinces = d3.nest()
      .key(function(d) {
        return d.id;
      })
      .map(data.provinces);

    data.users.byId = d3.nest()
      .key(function(d) {
        return d.id;
      })
      .map(data.users.values);

    return data;
  })();

  console.log(data);

  var windowW = $(window).width();
  if (windowW < 1024) {
    windowW = 1024;
  }
  var marginSide = 50;
  var svgW = windowW - marginSide * 2;
  var stackW = 100;
  var marginIn = 10;
  var axisW = svgW - stackW - marginIn;
  var svg = d3.select('svg')
    .attr('width', svgW)
    .attr('height', 808);

  // Initialize detailed user info part.
  $('#user-info').css('left', axisW + marginIn);
  $('#user-info').css('top', marginSide);
  $('#user-info').fadeOut();

  var users = (function(){
    var users = {};

    var USER_PLOT_MIN_RADIUS = 1;
    var USER_PLOT_MAX_RADIUS = 10;
    var USER_LAYER_TOP = 0;
    var USER_LAYER_HEIGHT = 200;
    var USER_LAYER_LEFT = USER_PLOT_MAX_RADIUS;
    var USER_LAYER_WIDTH = axisW - USER_PLOT_MAX_RADIUS * 2;

    // sort users by province
    var sortByProvince = d3.range(data.users.values.length)
      .sort(function(u1, u2) {
        return data.users.values[u1].province - data.users.values[u2].province;
      });

    // nest by province, city and locations
    data.users.byProvince = d3.nest()
      .key(function(d){
        return d.province;
      })
      .entries(data.users.values);

    // state array for highlighted provinces
    var highlightedPVCIds = [];
    for(i in data.provinces){
      highlightedPVCIds[i] = false;
    }
    var highlighedEver = false;
    var highlightedUser = null;
    // draw province semi-ellipse
    (function drawProvinceEllipse() {
      var count = 0;
      var provinceRadiusScale = d3.scale.linear()
        .domain([0, data.users.values.length])
        .range([0, USER_LAYER_WIDTH]);

      data.users.byProvince.forEach(function(p){
        d3.select('g#provice-ellipses-wrapper').append('path')
          .attr('d', function(){
            return 'M ' + (USER_LAYER_LEFT + provinceRadiusScale(count)) + ',' + (USER_LAYER_TOP + USER_LAYER_HEIGHT/2) +
              ' a' + (provinceRadiusScale(p.values.length))/2 + ',' + (provinceRadiusScale(p.values.length))/4 + ' 0 0,1 ' +
              provinceRadiusScale(p.values.length) + ',0';
          })
          .attr('class', function(d, i) {
            return 'province-ellipse normal user-part p' + p.key;
          })
          .attr('title', function(){
            return data.provinces[p.key][0].name;
          })
          .on('click', function(){
            if (highlightedPVCIds[p.key] == true){
              d3.selectAll('.p' + p.key).classed('not-highlighted', true);
              d3.selectAll('.p' + p.key).classed('highlighted', false);
              highlightedPVCIds[p.key] = false;
              var found = false;
              for(var i in highlightedPVCIds){
                if (highlightedPVCIds[i] == true){
                  found = true;
                  break;
                }
              }
              if (!found){
                users.deselectAllUsers();
                highlighedEver = false;
              }
            }
            else{
              highlightedPVCIds[p.key] = true;
              if(!highlighedEver){
                users.deselectAllUsers();
                highlighedEver = true;
                d3.selectAll('.user-part').classed('not-highlighted', true);
                d3.selectAll('.user-part').classed('highlighted', false);
                d3.selectAll('.user-part').classed('normal', false);
              }
              d3.selectAll('.p' + p.key).classed('not-highlighted', false);
              d3.selectAll('.p' + p.key).classed('highlighted', true);
              d3.selectAll('.p' + p.key).classed('normal', false);
            }
            var selectedIDs = [];
            data.users.byProvince.forEach(function(pvc) {
              if (highlightedPVCIds[pvc.key]){
                pvc.values.forEach(function(u) {
                  selectedIDs.push(u.id);
                })
              }
            });            
            statuses.filterByUsers(selectedIDs);// Call status view to highlight the users.
          });
        $('.province-ellipse').tipsy({gravity: 's'});
        count += p.values.length;
      });
    })();

    // scale for followers
    var radiusByFollowerScale = d3.scale.pow()
      .domain([0, d3.max(data.users.values, function(d){return d.followers_count;})
        ])
      .range([USER_PLOT_MIN_RADIUS, USER_PLOT_MAX_RADIUS])
      .exponent(.75);

    var xScaleByProvince = d3.scale.ordinal()
      .domain(sortByProvince)
      .rangeBands([USER_LAYER_LEFT, USER_LAYER_LEFT+USER_LAYER_WIDTH]);
    var userCircleY = USER_LAYER_TOP + USER_LAYER_HEIGHT / 2;
    
    // draw user province
    d3.select('g#users-wrapper')
      .selectAll('.userplot')
      .data(data.users.values).enter()
      .append('circle')
      .attr('class', function(d, i){
        return 'userplot normal user-part p' + d.province;
      })
      .attr('r', function(d){
        return radiusByFollowerScale(d.followers_count);
      })
      .attr('transform', function(d, i){
        var x = xScaleByProvince(i);
        data.users.byId[d.id][0].x = x;
        return 'translate(' + x + ',' + userCircleY + ')';
      })
      .attr('title', function(d, i){
        return '<img class="avatar" src="' + d.profile_image_url + '" /> ' +
          '<div class="user-info"><p class="user-name">' + d.name + '</p>' +
          '<p>' + d.followers_count.format() + ' followers</p>' +
          '<p>' + d.statuses_count.format() + ' statuses</p>'
          '</div>';
      })
      .attr('id', function(d, i){
        return 'u' + d.id;
      })
      .on('click', function(d) {
        highlighedEver = false;
        if (highlightedUser == d.id){
          users.deselectAllUsers();
          statuses.filterByUsers([]);
          clearUserInfo();
        }
        else{
          users.selectById(d.id);
        }        
      });
    $('.userplot').tipsy({html: true, gravity: 's'});

    // set color by gender
    svg.selectAll('.userplot')
      .attr('fill', function(d){
        if (d.gender == 'f')
          return colors[3][5];
        else return colors[1][5];
      });

    function showUserInfo(id) {
      $('#user-info').fadeIn();
      var user = data.users.byId[id][0];
      $('#profile-link').attr('href', 'http://weibo.com/' + user.profile_url)
        .attr('target', '_blank');
      $('#avatar').attr('src', user.avatar_large);
      $('#name').text(user.name);
      $('#followers-count').text(user.followers_count.format() + ' followers');
      $('#location').text(user.location);
      $('#statuses-count').text(user.statuses_count.format() + ' statuses');
    }

    function clearUserInfo() {
      $('#user-info').fadeOut();      
    }

    // hightlight a user by id.
    users.selectById = function(id){
      highlighedEver = false;
      highlightedPVCIds = [];
      highlightedUser = id;
      users.deselectAllUsers();
      d3.selectAll('.userplot').classed('not-highlighted', true);
      d3.selectAll('.userplot').classed('normal', false);
      d3.selectAll('.userplot').classed('highlighted', false);
      d3.selectAll('#u'+id).classed('not-highlighted', false);
      d3.selectAll('#u'+id).classed('highlighted', true);
      var selectedIDs = [id];
      statuses.filterByUsers(selectedIDs);
      showUserInfo(id);
    }

    // deselect all users, restore states
    users.deselectAllUsers = function(){
      d3.selectAll('.user-part').classed('highlighted', false);
      d3.selectAll('.user-part').classed('not-highlighted', false);
      d3.selectAll('.user-part').classed('normal', true);
      statuses.filterByUsers([]);
      clearUserInfo();
    }

    users.userCircleXById = function(id) {
      if (!data.users.byId[id]) {
        return 0;
      }
      return data.users.byId[id][0].x;
    };
    users.userCircleY = userCircleY;

    return users;
  })();

  var statuses = (function() {
    var statuses = {};

    var layersTop = 300;
    var layerLeft = 20;
    var layerHeight = 75;
    var layerWidth = axisW - layerLeft * 2;
    var layerHeightExpanded = 75;
    var layerHeightHalfExpanded = 20;
    var nLayers = 7;

    // topics -> [0, nTopics - 1]
    var topicOrdinal = (function() {
      var ordinalMap = {};
      var len = data.statuses.byTopic.length;
      for (var i = 0; i < len; i++) {
        ordinalMap[data.statuses.byTopic[i].key] = i;
      }
      return function(topic) {
        return ordinalMap[topic];
      };
    })();

    var statusBubbles = (function() {
      var statusBubbles = {};

      var statusRMin = 2;
      var statusRMax = 20;

      var createdTimeExtent = d3.extent(data.statuses.values, function(d) {
        return d.created_at_time;
      });

      // status time -> line
      var whichLayer = d3.scale.quantize()
        .domain(createdTimeExtent)
        .range(d3.range(nLayers));

      var layerY = function(layerId) {
        return layerId * layerHeight + layersTop;
      };

      var baselineD = function(d, i, opt) {
        var y = layerY(i);
        if (opt && opt.expanded) {
          var h = layerHeightExpanded;
        } else if (opt && opt.halfExpanded) {
          var h = layerHeightHalfExpanded;
        } else {
          var h = 2;
        }
        return 'M' + layerLeft + ' ' + (y - h / 2)
          + 'L' + (layerLeft + layerWidth) + ' ' + (y - h / 2)
          + 'L' + (layerLeft + layerWidth) + ' ' + (y + h / 2)
          + 'L' + layerLeft + ' ' + (y + h / 2)
          + 'Z';
      };

      var statusYExpandedPlain = d3.scale.linear()
        .domain(createdTimeExtent)
        .range([0, layerHeightExpanded * nLayers]);
      var statusCircleX = function(d, i, n) {
        // console.log(layerLeft + layerWidth / (n + 1) * (i + 1), layerLeft, layerWidth, n, i)
        return layerLeft + layerWidth / (n + 1) * (i + 1);
      };
      var statusCircleY = function(d, i, layerId) {
        return layersTop
          + statusYExpandedPlain(d.created_at_time)
          - layerHeightExpanded / 2
          - layerId * (layerHeightExpanded - layerHeight);
      };
      var statusTranform = function(d, i, n, opt) {
        // i: index in the layer
        // n: number of statuses in the layer
        var x = statusCircleX(d, i, n);
        if (opt && opt.expanded) {
          var y = statusCircleY(d, i, whichLayer(d.created_at_time));
        } else {
          var y = layerY(whichLayer(d.created_at_time));
        }
        return 'translate(' + x + ',' + y + ')';
      };
      var linkD = function(d, i, n, opt) {
        // user circle coord
        var xu = users.userCircleXById(d.user.$id);
        var yu = users.userCircleY;

        // status circle coord
        var xs = statusCircleX(d, i, n);
        if (opt && opt.expanded) {
          var du = 100;
          var ds = 75;
          var ys = statusCircleY(d, i, whichLayer(d.created_at_time));
        } else {
          var du = 100;
          var ds = 100;
          var ys = layerY(whichLayer(d.created_at_time));
        }

        return 'M' + xu + ',' + yu
          + 'C' + xu + ',' + (yu + du)
          + ' ' + xs + ',' + (ys - ds)
          + ' ' + xs + ',' + ys;
      };

      // nest statuses by layer
      data.statuses.byLayer = d3.nest()
        .key(function(d) {
          return whichLayer(d.created_at_time);
        })
        .sortKeys(function(a, b) {
          return a - b;
        })
        .sortValues(function(a, b) {
          var topicIdA = topicOrdinal(a.topic);
          var topicIdB = topicOrdinal(b.topic);
          if (topicIdA !== topicIdB) {
            return topicIdA - topicIdB;
          }
          // return b.reposts_count - a.reposts_count;
          return b.sentiment - a.sentiment;  // desc
        })
        .entries(data.statuses.values);

      // nest statuses in each layer by topic
      data.statuses.byLayer.forEach(function(layer) {
        layer.byTopic = d3.nest()
          .key(function(d) {
            return d.topic;
          })
          .entries(layer.values);
        var offset = 0;
        var len = layer.byTopic.length;
        for (var i = 0; i < len; i++) {
          layer.byTopic[i].offset = offset;
          offset += layer.byTopic[i].values.length;
        }
      });

      var statusR = d3.scale.pow()
        .exponent(.25)
        .domain(d3.extent(data.statuses.values, function(d) {
          return d.reposts_count * 5 + d.comments_count;
        }))
        .range([statusRMin, statusRMax]);

      var linksG = d3.select('g#user-status-links-wrapper');
      var statusLayersG = d3.select('g#status-layers-wrapper');
      var statusesG = d3.select('g#statuses-wrapper');

      // draw baselines
      var layerPaths = statusLayersG.selectAll('path.layer-baseline')
        .data(d3.range(nLayers))
        .enter()
        .append('path')
        .attr('class', function(d) {
          return 'layer-baseline layer' + d;
        })
        .attr('d', function(d, i) {
          return baselineD(d, i);
        })
        .attr('title', function(d) {
          data.statuses.byLayer[d].start = d3.min(data.statuses.byLayer[d].values, function(v) {
            return v.created_at_time;
          });
          data.statuses.byLayer[d].end = d3.max(data.statuses.byLayer[d].values, function(v) {
            return v.created_at_time;
          });
          return (new Date(data.statuses.byLayer[d].start * 1000)).format()
            + '<br />-<br />'
            + (new Date(data.statuses.byLayer[d].end * 1000)).format();
        });
      $('path.layer-baseline').tipsy({html: true, gravity: 's'});

      // draw statuses
      var statusCircleLayers = [];
      data.statuses.byLayer.forEach(function(layer) {
        statusCircleLayers[layer.key] = [];
        layer.byTopic.forEach(function(topic) {
          statusCircleLayers[layer.key][topicOrdinal(topic.key)]
            = statusesG.selectAll('circle.status'
              + '.layer' + layer.key
              + '.topic' + topicOrdinal(topic.key))
              .data(topic.values)
              .enter()
              .append('circle')
              .attr('class', function(d) {
                return 'status layer' + layer.key + ' topic' + topicOrdinal(d.topic);
              })
              .attr('r', function(d) {
                return statusR(d.reposts_count * 5 + d.comments_count);
              })
              .attr('transform', function(d, i) {
                return statusTranform(d, topic.offset + i, layer.values.length);
              })
              .style('fill', function(d, i) {
                return colors[topicOrdinal(d.topic)][5];
              })
              .attr('title', function(d) {
                var time = new Date(d.created_at_time * 1000);
                return '<div class="status-info"><p class="status-content"><span class="user-name">@' + data.users.byId[d.user.$id][0].name
                  + '</span>: ' + d.text + '</p>'
                  + '<p>' + time.format() + '</p>'
                  + '<p><span>' + d.reposts_count.format() + ' reposts</span><span style="margin-left:10px">' + d.comments_count.format() + ' comments</span></p></div>';
              });
        });
      });
      $('circle.status').tipsy({html: true, gravity: 's'});

      // draw user-status links
      var linkPathLayers = [];
      data.statuses.byLayer.forEach(function(layer) {
        linkPathLayers[layer.key] = [];
        layer.byTopic.forEach(function(topic) {
          linkPathLayers[layer.key][topicOrdinal(topic.key)]
            = linksG.selectAll('path.user-status-link'
              + '.layer' + layer.key
              + '.topic' + topicOrdinal(topic.key))
              .data(topic.values)
              .enter()
              .append('path')
              .attr('class', function(d) {
                return 'user-status-link layer' + layer.key + ' topic' + topicOrdinal(d.topic);
              })
              .attr('d', function(d, i) {
                return linkD(d, topic.offset + i, layer.values.length);
              });
        });
      });

      var controller = (function() {
        var controller = {};

        var isExpanded = [];
        d3.range(nLayers).forEach(function(layerId) {
          isExpanded.push(false);
        });
        var topicSelected = [];
        data.statuses.byTopic.forEach(function(topic) {
          topicSelected.push(true);
        });

        var render = function(layerId) {
          if (layerId) {
            // only render one layer
            d3.select('path.layer-baseline.layer' + layerId)
              .transition()
                .attr('d', function(d) {
                  return baselineD(d, layerId, {expanded: isExpanded[layerId]});
                });

            var offsets = {};
            var sum = 0;
            var len = data.statuses.byLayer[layerId].byTopic.length;
            for (var i = 0; i < len; i++) {
              var topic = data.statuses.byLayer[layerId].byTopic[i];
              offsets[topic.key] = sum;
              if (topicSelected[topicOrdinal(topic.key)]) {
                sum += topic.values.length;
              };
            }

            data.statuses.byLayer[layerId].byTopic.forEach(function(topic) {
              var circles = statusCircleLayers[layerId][topicOrdinal(topic.key)];
              if (circles) {
                circles
                  .transition()
                    .attr('transform', function(d, i) {
                      return topicSelected[topicOrdinal(topic.key)]
                        ? statusTranform(d,
                            offsets[topic.key] + i,
                            sum,
                            {expanded: isExpanded[layerId]})
                        : statusTranform(d,
                            offsets[topic.key],
                            sum,
                            {expanded: isExpanded[layerId]});
                    })
                    .attr('r', function(d) {
                      return topicSelected[topicOrdinal(topic.key)]
                        ? statusR(d.reposts_count * 5 + d.comments_count)
                        : 0;
                    });
              }
              var paths = linkPathLayers[layerId][topicOrdinal(topic.key)];
              if (paths) {
                paths
                  .classed('expanded', isExpanded[layerId])
                  .classed('topic-deselected', !topicSelected[topicOrdinal(topic.key)])
                  .transition()
                    .attr('d', function(d, i) {
                      return topicSelected[topicOrdinal(topic.key)]
                        ? linkD(d,
                          offsets[topic.key] + i,
                          sum,
                          {expanded: isExpanded[layerId]})
                        : linkD(d,
                            offsets[topic.key],
                            sum,
                            {expanded: isExpanded[layerId]});
                    })
                    .style('stroke', function(d) {
                      return isExpanded[layerId]
                        ? colors[topicOrdinal(d.topic)][5]
                        : '';
                    });
              }
            });
          } else {
            // render all layers
            data.statuses.byLayer.forEach(function(layer) {
              render(layer.key);
            });
          }
        };

        controller.expand = function(layerId) {
          isExpanded[layerId] = true;
          render(layerId);
        };

        controller.collapse = function(layerId, preserveExpand) {
          if (preserveExpand && isExpanded[layerId]) {
            return;
          }
          isExpanded[layerId] = false;
          render(layerId);
        };

        controller.halfExpand = function(layerId) {
          if (!isExpanded[layerId]) {
            d3.select('path.layer-baseline.layer' + layerId)
              .transition()
                .attr('d', function(d) {
                  return baselineD(d, layerId, {halfExpanded: true});
                });
          }
        };

        controller.toggleExpand = function(layerId) {
          isExpanded[layerId]
            ? controller.collapse(layerId)
            : controller.expand(layerId);
        };

        controller.filterByUsers = function(uids) {
          var isEmpty = (uids.length === 0);
          statusesG.classed('selecting', !isEmpty);
          linksG.classed('selecting', !isEmpty);
          var isSelected = function(d) {
            var len = uids.length;
            for (var i = 0; i < len; i++) {
              if (uids[i] == d.user.$id) {
                return true;
              }
            }
            return false;
          };
          statusCircleLayers.forEach(function(statusCircleLayer) {
            statusCircleLayer.forEach(function(statusCircleLayerTopic) {
              if (isEmpty) {
                statusCircleLayerTopic.classed('selected', false);
              }
              statusCircleLayerTopic.classed('selected', isSelected);
            });
          });
          linkPathLayers.forEach(function(linkPathLayer) {
            linkPathLayer.forEach(function(linkPathLayerTopic) {
              if (isEmpty) {
                linkPathLayerTopic.classed('selected', false);
              }
              linkPathLayerTopic.classed('selected', isSelected);
            });
          });
        };

        controller.filterByTopic = function(newTopicSelected) {
          var len = newTopicSelected.length;
          var allFalse = true;
          for (var i = 0; i < len; i++) {
            topicSelected[i] = newTopicSelected[i];
            if (topicSelected[i]) {
              allFalse = false;
            }
          }
          if (allFalse) {
            for (var i = 0; i < len; i++) {
              topicSelected[i] = true;
            }
          }
          render();
        };

        // interaction
        layerPaths
          .on('mouseover', function(d, i) {
            controller.halfExpand(i);
          })
          .on('mouseout', function(d, i) {
            controller.collapse(i, true);
          })
          .on('click', function(d, i) {
            controller.toggleExpand(i);
          });

        var selectedUserId = null;

        for (var i in statusCircleLayers) {
          (function() {
            var layerId = i;
            statusCircleLayers[layerId].forEach(function(statusCircleLayerTopic) {
              statusCircleLayerTopic
                .on('mouseover', function() {
                  controller.halfExpand(layerId);
                })
                .on('mouseout', function() {
                  controller.collapse(layerId, true);
                })
                .on('click', function(d) {
                  if (isExpanded[layerId]) {
                    if (selectedUserId === d.user.$id) {
                      selectedUserId = null;
                      users.deselectAllUsers();
                    } else {
                      selectedUserId = d.user.$id;
                      users.selectById(d.user.$id);
                    }
                  } else {
                    controller.expand(layerId);
                  }
                });
            });
          })();
        }

        return controller;
      })();

      statusBubbles.filterByUsers = controller.filterByUsers;
      statusBubbles.filterByTopic = controller.filterByTopic;
      return statusBubbles;
    })();


    var statusStack = (function() {
      var statusStack = {};

      var stackTop = layersTop - layerHeightExpanded / 2;
      var stackLeft = axisW + marginIn;
      var stackHeight = layerHeight * nLayers;
      var stackWidth = stackW;

      var iconWidth = 24;
      var iconHeight = iconWidth;
      var iconMargin = 5;
      var denormalizeBtn = $('#stack-normalization-switch > .denormalize')
        .append('<img />')
        .children()
          .addClass('active')
          .css('left', stackLeft + stackWidth - iconWidth - iconMargin + 50)
          .css('top', stackTop + iconMargin + 50)
          .attr({
            src: 'images/stacked-area-chart.png',
            width: iconWidth,
            height: iconHeight
          })
          .click(function() {
            switchMode();
            $(this).addClass('active');
            normalizeBtn.removeClass('active');
          });
      var normalizeBtn = $('#stack-normalization-switch > .normalize')
        .append('<img />')
        .children()
          .css('left', stackLeft + stackWidth - iconWidth - iconMargin + 50)
          .css('top', stackTop + iconMargin * 2 + iconHeight + 50)
          .attr({
            src: 'images/stacked-area-chart-n.png',
            width: iconWidth,
            height: iconHeight
          })
          .click(function() {
            switchMode(true);
            $(this).addClass('active');
            denormalizeBtn.removeClass('active');
          });

      //nest by time within topics
      var nTimeBucket = 40;
      var timeScale = d3.scale.linear()
        .domain([d3.min(data.statuses.values, function(d) {
          return d.created_at_time;
        }), d3.max(data.statuses.values, function(d) {
          return d.created_at_time;
        })])
        .rangeRound([0, nTimeBucket]);

      data.statuses.byTopic.forEach(function(t) {
        t.byTime = [];
        for (i in d3.range(nTimeBucket + 1)) {
          t.byTime[i] = {
            x: i,
            y: 0
          };
        }
        t.values.forEach(function(d) {
          t.byTime[timeScale(d.created_at_time)].y++;
        });
      });

      var stack = d3.layout.stack()
        .values(function(d){
          return d.byTime;
        })
        .x(function(d) {
          return d.x;
        })
        .y(function(d) {
          return d.y;
        });
      stack(data.statuses.byTopic);

      // Calculate the percentage.
      data.statuses.byTopic.forEach(function(t) {
        for (var i in t.byTime){
          var last = data.statuses.byTopic[data.statuses.byTopic.length-1].byTime[i];
          t.byTime[i].p = (t.byTime[i].y) / (last.y + last.y0);
          t.byTime[i].p0 = (t.byTime[i].y0) / (last.y + last.y0);
        }
      });

      var areaXScale = d3.scale.linear()
        // .exponent(.5)
        .domain([0, d3.max(data.statuses.byTopic[data.statuses.byTopic.length-1].byTime, function(d) {
          return d.y0 + d.y;
        })])
        .range([stackLeft, stackLeft + stackWidth]);
      var areaYScale = d3.scale.linear()
        .domain([0, nTimeBucket])
        .range([stackTop, stackTop + stackHeight]);
      var area = d3.svg.area()
        .y(function(d) {
          return areaYScale(d.x);
        })
        .x0(function(d) {
          return areaXScale(d.y0);
        })
        .x1(function(d) {
          return areaXScale(d.y + d.y0);
        });

      var areaNormalized = d3.svg.area()
        .y(function(d) {
          return areaYScale(d.x);
        })
        .x0(function(d) {
          return areaPXScale(d.p0);
        })
        .x1(function(d) {
          return areaPXScale(d.p0 + d.p);
        });

      var areaPXScale = d3.scale.linear()
        .domain([0, 1])
        .range([stackLeft, stackLeft + stackWidth]);

      switchMode = function(isNormalized) {
        if (isNormalized){
          d3.selectAll('.status-stack-layer')
            .transition()
            .attr('d', function(d) {
              return areaNormalized(d.byTime);
            });
        }
        else{
          d3.selectAll('.status-stack-layer')
            .transition()
            .attr('d', function(d) {
              return area(d.byTime);
            }); 
        }
      };

      var statusStackG = d3.select('g#status-stack-wrapper');
      var stackPaths = statusStackG
        .selectAll('path.status-stack-layer')
        .data(data.statuses.byTopic).enter()
        .append('path')
        .attr('class', 'status-stack-layer')
        .attr('d', function(d) {
          return area(d.byTime);
        })
        .style('fill', function(d) {
          return colors[topicOrdinal(d.key)][5];
        })
        .attr('title', function(d) {
          return d.key + '<span style="margin-left:10px">' + d.values.length.format() + ' statuses</span>';
        });
      $('path.status-stack-layer').tipsy({html: true, gravity: 's'});

      // legends
      // start time
      statusStackG.append('text')
        .attr('class', 'legend-element stack-time-label')
        .text((new Date(data.statuses.byLayer[0].start * 1000)).format())
        .attr('transform', 'rotate(90), translate(' + stackTop + ',' + (0 - stackLeft) + ')')
        .attr('text-anchor', 'start')
        .attr('dy', '1em');
      // end time
      statusStackG.append('text')
        .attr('class', 'legend-element stack-time-label')
        .text((new Date(data.statuses.byLayer[nLayers - 1].end * 1000)).format())
        .attr('transform', 'rotate(90), translate(' + (stackTop + stackHeight) + ',' + (0 - stackLeft) + ')')
        .attr('text-anchor', 'end')
        .attr('dy', '1em');

      var controller = (function() {
        var controller = {};

        var isSelected = [];
        d3.range(data.statuses.byTopic.length).forEach(function(topicId) {
          isSelected.push(false);
        });
        var selectionEmpty = function() {
          var len = isSelected.length;
          for (var i = 0; i < len; i++) {
            if (isSelected[i] === true) {
              return false;
            }
          }
          return true;
        };

        var render = function() {
          if (selectionEmpty()) {
            statusStackG.classed('selecting', false);
            stackPaths
              .classed('selected', false)
              .transition()
                .style('fill', function(d) {
                  return colors[topicOrdinal(d.key)][5];
                });
          } else {
            statusStackG.classed('selecting', true);
            stackPaths
              .classed('selected', function(d) {
                return isSelected[topicOrdinal(d.key)] ? true : false;
              })
              .transition()
                .style('fill', function(d) {
                  return isSelected[topicOrdinal(d.key)]
                    ? colors[topicOrdinal(d.key)][5]
                    : '';
                });
          }
          statusBubbles.filterByTopic(isSelected);
        };

        controller.select = function(topicId) {
          isSelected[topicId] = true;
          render();
        };

        controller.deselect = function(topicId) {
          isSelected[topicId] = false;
          render();
        };

        controller.clearSelection = function() {
          var len = isSelected.length;
          for (var i = 0; i < len; i++) {
            isSelected[i] = false;
          }
          render();
        };

        controller.toggleSelect = function(topicId) {
          isSelected[topicId]
            ? controller.deselect(topicId)
            : controller.select(topicId);
        };

        stackPaths.on('click', function(d) {
          controller.toggleSelect(topicOrdinal(d.key));
        });

        return controller;
      })();

      return statusStack;
    })();


    statuses.filterByUsers = function(uids) {
      statusBubbles.filterByUsers(uids);
    };

    return statuses;
  })();
};

d3.json('data/users.json', function(users) {
  d3.json('data/statuses.json', function(statuses){
    d3.json('data/provinces.json', function(provinces) {
      var filteredStatuses = [];
      statuses.forEach(function(d) {
        if (Math.random() < .5) {
          filteredStatuses.push(d);
        }
      });
      vis({
        users: {
          values: users
        },
        statuses: {
          values: filteredStatuses
        },
        provinces: provinces.provinces
      });
    });
  });
});