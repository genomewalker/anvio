/**
 * Javascript library to visualize anvi'o charts
 *
 *  Author: A. Murat Eren <a.murat.eren@gmail.com>
 *  Credits: Özcan Esen, Gökmen Göksel, Tobias Paczian.
 *  Copyright 2015, The anvio Project
 *
 * This file is part of anvi'o (<https://github.com/meren/anvio>).
 *
 * Anvi'o is a free software. You can redistribute this program
 * and/or modify it under the terms of the GNU General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with anvi'o. If not, see <http://opensource.org/licenses/GPL-3.0>.
 *
 * @license GPL-3.0+ <http://opensource.org/licenses/GPL-3.0>
 */

var request_prefix = getParameterByName('request_prefix');
var VIEWER_WIDTH = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth;

var layers;
var coverage;
var variability;
var maxVariability = 0;
var geneParser;
var contextSvg;
var state;
var layers_ordered;
var visible_layers;
var contig_id;
var highlight_gene;
var gene_view;


function loadAll() {
    $.ajaxPrefilter(function(options) {
        if (request_prefix) {
            options.url = request_prefix + options.url;
            if (options.type.toLowerCase() == 'post')
            {
                options.data += '&csrfmiddlewaretoken=' + getCookie('csrftoken');
            }
        }
        return options;
    });

    contig_id = getParameterByName('id');
    highlight_gene = getParameterByName('highlight_gene') == 'true';
    gene_view = getParameterByName('gene_view') == 'true';

    if (typeof sessionStorage.state === 'undefined')
    {
        alert("Something went wrong, couldn't access to sessionStorage");
    }
    else
    {
        // backup the state, if user changes the page (prev, next) we are going to overwrite it.
        state = JSON.parse(sessionStorage.state);
        var endpoint = (gene_view ? 'charts_for_single_gene' : 'charts');
        $.ajax({
                type: 'GET',
                cache: false,
                url: '/data/' + endpoint + '/' + state['order-by'] + '/' + contig_id,
                success: function(contig_data) {
                    page_header = contig_data.title;
                    layers = contig_data.layers;
                    coverage = contig_data.coverage;
                    variability = [];

                    for (var i=0; i<coverage.length; i++) {
                        variability[i] = [];
                        for (var l=0; l<4; l++) {
                            variability[i][l] = [];
                            for (var h=0; h<coverage[i].length; h++) {
                                if (contig_data.variability[i][l].hasOwnProperty(h)) {
                                    variability[i][l].push(contig_data.variability[i][l][h]);
                                    if (contig_data.variability[i][l][h] > maxVariability) {
                                        maxVariability = contig_data.variability[i][l][h];
                                    }
                                } else {
                                    variability[i][l].push(0);
                                }
                            }
                        }
                    }

                    competing_nucleotides = contig_data.competing_nucleotides;
                    previous_contig_name = contig_data.previous_contig_name;
                    next_contig_name = contig_data.next_contig_name;
                    index = contig_data.index;
                    total = contig_data.total;
                    genes = contig_data.genes;

                    if(layers.length == 0){
                        console.log('Warning: no layers returned')
                    }

                    next_str = " | next &gt;&gt;&gt;";
                    prev_str = "&lt;&lt;&lt; prev | ";
                    position = index + " of " + total;

                    // anvi-server uses iframes for prettier urls, links need to be open _top
                    var target_str = '';

                    if (self != top) {
                        target_str = 'target="_top"';
                    }

                    if(next_contig_name)
                        next_str = '<a onclick="sessionStorage.state = JSON.serialize(state);" href="' + generate_inspect_link('inspect', next_contig_name) +'" '+target_str+'> | next &gt;&gt;&gt;</a>';

                    if(previous_contig_name)
                        prev_str = '<a onclick="sessionStorage.state = JSON.serialize(state);" href="' + generate_inspect_link('inspect', previous_contig_name) +'" '+target_str+'>&lt;&lt;&lt; prev | </a>';

                    $('#header').append("<strong>" + page_header + "</strong> detailed <br /><small><small>" + prev_str + position + next_str + "</small></small></br></br>");

                    $('.main').prepend('<div style="text-align: left; padding-left: 40px; padding-bottom: 20px;"> \
                                            <button type="button" class="btn btn-primary btn-xs" onclick="showSetMaxValuesDialog()" class="btn btn-outline-primary">Set maximum values</button> \
                                            <button type="button" class="btn btn-primary btn-xs" onclick="resetMaxValues()" class="btn btn-outline-primary">Reset maximum values</button> \
                                        </div>');

                    
                    createCharts(state);
                    $('.loading-screen').hide();
                }
            });
    }
    
}


function showSetMaxValuesDialog() {
    var table = '<table class="table borderless"><thead class="thead-light"><tr><th>Sample</th><th>Max Coverage</th><th>Limit Max Coverage</th></tr></thead><tbody>';

    var max_coverage_values;
    var has_max_coverage_values = (typeof sessionStorage.max_coverage !== 'undefined');
    if (has_max_coverage_values) {
        max_coverage_values = JSON.parse(sessionStorage.max_coverage);
    }

    var j=0;
    for (i in layers_ordered) {
        var layer_name = layers_ordered[i];
        var layer_index = layers.indexOf(layer_name);

        if (!(_state['layers'].hasOwnProperty(layer_name) && parseFloat(_state['layers'][layer_name]['height']) == 0)) {
            var max_val
            var actual_max_val = Math.max.apply(null, coverage[layer_index]);;
            if (has_max_coverage_values) {
                max_val = max_coverage_values[j];
            } else {
                max_val = 0;
            }
    
            table += '<tr> \
                        <td>' + layer_name + '</td> \
                        <td><a href="#" onclick="$(\'#max_multiple\').val(\'' + actual_max_val + '\')">' + actual_max_val + '</a></td> \
                        <td style="text-align: center;"><input class="form-control input-sm max-coverage-input" type="text" size="5" value="' + max_val + '"/></td> \
                      </tr>';

            j++;
        }
    }

    table += '<tr> \
                <td>Set Max for all samples:</td> \
                <td>&nbsp;</td> \
                <td style="text-align: center;"><div class="input-group">\
                    <input class="form-control input-sm" id="max_multiple" type="text" size="5" value="0"/> \
                        <span class="input-group-btn"> \
                            <button type="button" class="btn btn-default btn-sm" onclick="$(\'.max-coverage-input\').val($(\'#max_multiple\').val());">Set</button> \
                        </span> \
                    </div> \
                </td> \
            </tr>';


    $('#setMaxValuesDialog .modal-body').empty().append(table + '</tbody></table>');
    $('#setMaxValuesDialog').modal('show');
}


function applyMaxValues() {
    var max_values = []
    $('#setMaxValuesDialog .modal-body tbody tr').each(function(index, row) {
        max_values.push(parseInt($(row).find('td:last input').val()));
    });

    sessionStorage.max_coverage = JSON.stringify(max_values);
    createCharts(state);
}


function resetMaxValues() {
    delete sessionStorage.max_coverage;
    createCharts(state);
}


function createCharts(state){
    /* Adapted from Tyler Craft's Multiple area charts with D3.js article:
    http://tympanus.net/codrops/2012/08/29/multiple-area-charts-with-d3-js/  */
    $('#chart-container, #context-container').empty();

    if (state['current-view'] == "single"){
        // if we are working with a non-merged single profile, we need to do some ugly hacks here,
        // simply because the sample name does not appear among 'layers' found in the state variable.
        layers_ordered = layers;
        state['layers'][layers[0]] = state['layers']['mean_coverage'];
    } else {
        // this is the usual path for merged profiles:
        layers_ordered = state['layer-order'].filter(function (value) { if (layers.indexOf(value)>-1) return true; return false; });
    }

    visible_layers = 0;
    for (i in layers_ordered)
    {
      var layer_id = layers_ordered[i];

      if (parseFloat(state['layers'][layer_id]['height']) > 0)
        visible_layers++;
    }

    geneParser = new GeneParser(genes);

    var margin = {top: 20, right: 50, bottom: 150, left: 50};
    var width = VIEWER_WIDTH * .80;
    var chartHeight = 200;
    var height = ((chartHeight + 10) * visible_layers);
    var contextHeight = 50;
    var contextWidth = width;

    var svg = d3.select("#chart-container").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", (height + margin.top + margin.bottom));

    $('#chart-container').css("width", (width + 150) + "px");
    $('#chart-container').css("height", height + "px");

    
    var charts = [];
    
    var layersCount = layers.length;
    
    coverage.forEach(function(d) {
        for (var prop in d) {
            if (d.hasOwnProperty(prop)) {
                d[prop] = parseFloat(d[prop]);
            }
        }
    });

    var max_coverage_values;
    var has_max_coverage_values = (typeof sessionStorage.max_coverage !== 'undefined');
    if (has_max_coverage_values) {
        max_coverage_values = JSON.parse(sessionStorage.max_coverage);
    }

    var j=0;
    for(var i = 0; i < layersCount; i++){
        var layer_index = layers.indexOf(layers_ordered[i]);

        if (parseFloat(state['layers'][layers_ordered[i]]['height']) == 0)
          continue;

        charts.push(new Chart({
                        name: layers[layer_index],
                        coverage: coverage[layer_index],
                        max_coverage: (has_max_coverage_values) ? max_coverage_values[j] : 0,
                        variability_a: variability[layer_index][0],
                        variability_b: variability[layer_index][1],
                        variability_c: variability[layer_index][2],
                        variability_d: variability[layer_index][3],
                        competing_nucleotides: competing_nucleotides[layer_index],
                        id: j++,
                        width: width,
                        height: chartHeight,
                        maxVariability: maxVariability,
                        svg: svg,
                        margin: margin,
                        showBottomAxis: (j == visible_layers - 1),
                        color: state['layers'][layers[layer_index]]['color']
                }));
        
    }


    contextSvg = d3.select("#context-container").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", 150);

    var defs = contextSvg.append('svg:defs');

    contextSvg.append("rect")
       .attr("width", width)
       .attr("height", "60px")
       .attr("fill", "black")
       .attr("fill-opacity", "0.2")
       .attr('transform', 'translate(50, 10)');

    // Define arrow markers
    ['green', 'gray', 'firebrick'].forEach(function(color){
      defs.append('svg:marker')
          .attr('id', 'arrow_' + color )
          .attr('markerHeight', 2)
          .attr('markerWidth', 2)
          .attr('orient', 'auto')
          .attr('refX', 0)
          .attr('refY', 0)
          .attr('viewBox', '-5 -5 10 10')
          .append('svg:path')
            .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
            .attr('fill', color);
    });

    $('#context-container').css("width", (width + 150) + "px");

    /* Context down below */
    var contextXScale = d3.scale.linear().range([0, contextWidth]).domain(charts[0].xScale.domain());

    var contextAxis = d3.svg.axis()
                .scale(contextXScale)
                .tickSize(contextHeight);

    var contextArea = d3.svg.area()
                .interpolate("monotone")
                .x(function(d) { return contextXScale(d); })
                .y0(contextHeight)
                .y1(0);

    var brush = d3.svg.brush()
                .x(contextXScale)
                .on("brushend", onBrush);

    var context = contextSvg.append("g")
                .attr("class","context")
                .attr("transform", "translate(" + (margin.left) + ", 80)");

    context.append("g")
                .attr("class", "x axis top")
                .attr("transform", "translate(0,0)")
                .call(contextAxis)

    context.append("g")
                .attr("class", "x brush")
                .call(brush)
                .selectAll("rect")
                .attr("y", 0)
                .attr("height", contextHeight);

    function onBrush(){
        /* this will return a date range to pass into the chart object */
        var b = brush.empty() ? contextXScale.domain() : brush.extent();
        b = [Math.floor(b[0]), Math.floor(b[1])];
        for(var i = 0; i < layersCount; i++){
            charts[i].showOnly(b);
        }
        drawArrows(b[0], b[1]);
    }

    drawArrows(0, charts[0].xScale.domain()[1]);
}


function Chart(options){
    this.coverage = options.coverage;
    this.max_coverage = options.max_coverage;
    this.variability_a = options.variability_a;
    this.variability_b = options.variability_b;
    this.variability_c = options.variability_c;
    this.variability_d = options.variability_d;
    this.competing_nucleotides = options.competing_nucleotides;
    this.width = options.width;
    this.height = options.height;
    this.maxVariability = options.maxVariability;
    this.svg = options.svg;
    this.id = options.id;
    this.name = options.name;
    this.margin = options.margin;
    this.showBottomAxis = options.showBottomAxis;
    this.color = options.color;
    
    var localName = this.name;
    var num_data_points = this.variability_a.length;
    
    this.xScale = d3.scale.linear()
                            .range([0, this.width])
                            .domain([0, this.coverage.length]);
   

    // this.max_coverage comes from options, -1 means not available
    // this.maxCoverage used in charts
    if (this.max_coverage == 0) {
        this.maxCoverage = Math.max(20, Math.max.apply(null, this.coverage));
    } else {
        this.maxCoverage = this.max_coverage;
    }

    this.yScale = d3.scale.linear()
                            .range([this.height,0])
                            .domain([0,this.maxCoverage]);

    this.yScaleLine = d3.scale.linear()
                            .range([this.height, 0])
                            .domain([0, this.maxVariability]);
    
    var xS = this.xScale;
    var yS = this.yScale;
    var ySL = this.yScaleLine;
    
    this.area = d3.svg.area()
                            .x(function(d, i) { return xS(i); })
                            .y0(this.height)
                            .y1(function(d) { return (yS(d) < 0) ? 0 : yS(d); });

    this.line = d3.svg.line()
                            .x(function(d, i) { return xS(i); })
                            .y(function(d, i) { if(i == 0) return ySL(0); if(i == num_data_points - 1) return ySL(0); return ySL(d); })
                            .interpolate('step-before');

    /*
        Assign it a class so we can assign a fill color
        And position it on the page
    */
    this.chartContainer = this.svg.append("g")
                        .attr('class',this.name.toLowerCase())
                        .attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + (this.height * this.id) + (10 * this.id)) + ")");

    this.lineContainer = this.svg.append("g")
                        .attr('class',this.name.toLowerCase())
                        .attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + (this.height * this.id) + (10 * this.id)) + ")");

    this.textContainer = this.svg.append("g")
                        .attr('class',this.name.toLowerCase())
                        .attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + (this.height * this.id) + (10 * this.id)) + ")");

    /* Add both into the page */
    this.chartContainer.append("path")
                              .data([this.coverage])
                              .attr("class", "chart")
                              .style("fill", this.color)
                              .style("fill-opacity", "0.5")
                              .attr("d", this.area);

    this.lineContainer.append("path")
        .data([this.variability_b])
        .attr("class", "line")
        .attr("name", "first_pos")
        .style("fill", '#990000')
        .attr("d", this.line);

    this.lineContainer.append("path")
        .data([this.variability_c])
        .attr("class", "line")
        .attr("name", "second_pos")
        .style("fill", '#990000')
        .attr("d", this.line);

    this.lineContainer.append("path")
        .data([this.variability_d])
        .attr("class", "line")
        .attr("name", "third_pos")
        .style("fill", '#004400')
        .attr("d", this.line);

    this.lineContainer.append("path")
        .data([this.variability_a])
        .attr("class", "line")
        .attr("name", "outside_gene")
        .style("stroke", '#666666')
        .style("stroke-width", "0.2")
        .attr("d", this.line);


    this.textContainer.selectAll("text")
                            .data(d3.entries(this.competing_nucleotides))
                            .enter()
                            .append("text")
                            .attr("x", function (d) { return xS(d.key); })
                            .attr("y", function (d) { return 0; })
                            .attr("writing-mode", "tb")
                            .attr("font-size", "7px")
                            .attr("glyph-orientation-vertical", "0")
                            .attr("style", "cursor:pointer;")
                            .attr("fill", function (d){ return get_comp_nt_color(d.value['competing_nts']); })
                            .attr('data-content', function(d) { 
                                return '<span class="popover-close-button" onclick="$(this).closest(\'.popover\').popover(\'hide\');"></span> \
                                        <h3>Content</h3> \
                                        <table class="table table-striped" style="width: 100%; text-align: center; font-size: 12px;"> \
                                            <tr><td>Position in split</td><td>' + d.value['pos'] +'</td></tr> \
                                            <tr><td>Position in contig</td><td>' + d.value['pos_in_contig'] +'</td></tr> \
                                            <tr><td>Reference</td><td>' + d.value['reference'] +'</td></tr> \
                                            <tr><td>Consensus</td><td>' + d.value['consensus'] +'</td></tr> \
                                            <tr><td>Departure from reference</td><td>' + d.value['departure_from_reference'].toFixed(4) +'</td></tr> \
                                            <tr><td>Departure from consensus</td><td>' + d.value['departure_from_consensus'].toFixed(4) +'</td></tr> \
                                            <tr><td>Competing nucleotides</td><td>' + d.value['competing_nts'] +'</td></tr> \
                                            <tr><td>Corresponding gene call</td><td>' + ((d.value['corresponding_gene_call'] == -1) ? 'No gene or in partial gene': d.value['corresponding_gene_call']) +'</td></tr> \
                                            <tr><td>Codon order in gene</td><td>' + ((d.value['codon_order_in_gene'] == -1) ? 'No gene or in partial gene': d.value['codon_order_in_gene']) +'</td></tr> \
                                            <tr><td>Base position in codon</td><td>' + ((d.value['base_pos_in_codon'] == 0) ? 'No gene or in partial gene': d.value['base_pos_in_codon']) +'</td></tr> \
                                            <tr><td>Coverage</td><td>' + d.value['coverage'] +'</td></tr> \
                                        </table> \
                                        <h3>Counts</h3> \
                                        <table class="table table-striped" style="width: 100%; text-align: center; font-size: 12px;"> \
                                            <tr><td>A</td><td>' + d.value['A'] +'</td></tr> \
                                            <tr><td>T</td><td>' + d.value['T'] +'</td></tr> \
                                            <tr><td>G</td><td>' + d.value['G'] +'</td></tr> \
                                            <tr><td>C</td><td>' + d.value['C'] +'</td></tr> \
                                            <tr><td>N</td><td>' + d.value['N'] +'</td></tr> \
                                        </table>';
                            })
                            .attr('data-toggle', 'popover')
                            .text(function (d) {
                                return d.value['competing_nts'];
                            });


    
    this.xAxisTop = d3.svg.axis().scale(this.xScale).orient("top");

    if(this.id == 0){
        this.chartContainer.append("g")
                    .attr("class", "x axis top")
                    .attr("transform", "translate(0,0)")
                    .call(this.xAxisTop);
    }
    
        
    this.yAxis = d3.svg.axis().scale(this.yScale).orient("left").ticks(5);
    this.yAxisLine = d3.svg.axis().scale(this.yScaleLine).orient("right").ticks(5);
        
    this.chartContainer.append("g")
                   .attr("class", "y axis")
                   .attr("transform", "translate(-15,0)")
                   .call(this.yAxis);

    this.lineContainer.append("g")
                   .attr("class", "y axis")
                   .attr("transform", "translate(" + (this.width + 15) + ",0)")
                   .call(this.yAxisLine);

    this.chartContainer.append("text")
                   .attr("class","country-title")
                   .attr("transform", "translate(0,20)")
                   .text(this.name);
    
}
    
Chart.prototype.showOnly = function(b){
    this.xScale.domain(b); var xS = this.xScale;
    this.chartContainer.selectAll("path").data([this.coverage]).attr("d", this.area);
    this.lineContainer.select("[name=outside_gene]").data([this.variability_a]).attr("d", this.line);
    this.lineContainer.select("[name=first_pos]").data([this.variability_b]).attr("d", this.line);
    this.lineContainer.select("[name=second_pos]").data([this.variability_c]).attr("d", this.line);
    this.lineContainer.select("[name=third_pos]").data([this.variability_d]).attr("d", this.line);
    this.textContainer.selectAll("text").data(d3.entries(this.competing_nucleotides)).attr("x", function (d) { return xS(d.key); });
    this.chartContainer.select(".x.axis.top").call(this.xAxisTop);
}

