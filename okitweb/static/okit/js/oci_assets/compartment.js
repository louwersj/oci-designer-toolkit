console.log('Loaded Internet Gateway Javascript');

/*
** Set Valid drop Targets
 */
asset_drop_targets[compartment_artifact] = [];
asset_connect_targets[compartment_artifact] = [];
asset_add_functions[compartment_artifact] = "addCompartment";
asset_delete_functions[compartment_artifact] = "deleteCompartment";
asset_clear_functions.push("clearCompartmentVariables");

const compartment_stroke_colour = "#F80000";
const compartment_query_cb = "compartment-query-cb";
let compartment_ids = [];
let compartment_count = 0;
let compartment_bui_sub_artifacts = {};

/*
** Reset variables
 */

function clearCompartmentVariables() {
    compartment_ids = [];
    compartment_count = 0;
    compartment_bui_sub_artifacts = {};
}

/*
** Add Asset to JSON Model
 */
function addCompartment(compartment_id='') {
    let id = 'okit-' + compartment_prefix + '-' + uuidv4();
    console.log('Adding ' + compartment_artifact + ' : ' + id);

    // Add Virtual Cloud Network to JSON

    if (!okitJson.hasOwnProperty('compartments')) {
        okitJson['compartments'] = [];
    }

    // Add id & empty name to id JSON
    okitIdsJsonObj[id] = '';
    compartment_ids.push(id);

    // Increment Count
    compartment_count += 1;
    let compartment = {};
    compartment['id'] = id;
    compartment['name'] = generateDefaultName(compartment_prefix, compartment_count);
    compartment['compartment_id'] = compartment_id;
    okitJson['compartments'].push(compartment);
    okitIdsJsonObj[id] = compartment['name'];
    //console.log(JSON.stringify(okitJson, null, 2));
    displayOkitJson();
    drawCompartmentSVG(compartment);
    loadCompartmentProperties(id);
    openCompartment(id);
    $('#' + id + "-tab-button").trigger('click');
}

function initialiseCompartmentChildData(id) {
    // Add BUI artifact positional information
    compartment_bui_sub_artifacts[id] = {
        "virtual_cloud_network_position": 0,
        "virtual_cloud_network_count": 0,
        "block_storage_position": 0,
        "block_storage_count": 0
    };
}

/*
** Delete From JSON Model
 */

function deleteCompartment(id) {
    console.log('Delete Compartment ' + id);
    // Remove SVG Element
    d3.select("#" + id + "-svg").remove()
    // Remove Data Entry
    for (let i=0; i < okitJson['compartments'].length; i++) {
        if (okitJson['compartments'][i]['id'] == id) {
            okitJson['compartments'].splice(i, 1);
        }
    }
    // Remove Subnet references
    if ('route_tables' in okitJson) {
        for (route_table of okitJson['route_tables']) {
            for (let i = 0; i < route_table['route_rules'].length; i++) {
                if (route_table['route_rules'][i]['network_entity_id'] == id) {
                    route_table['route_rules'].splice(i, 1);
                }
            }
        }
    }
}

/*
** SVG Creation
 */
function getCompartmentDimensions(id='') {
    let dimensions = {width:$('#canvas-wrapper').width(), height:$('#canvas-wrapper').height()}
    //return {width:2150, height:1500};
    return dimensions;
}

function newCompartmentDefinition(artifact, position=0) {
    let dimensions = getCompartmentDimensions();
    let definition = newArtifactSVGDefinition(artifact, compartment_artifact);
    definition['svg']['width'] = dimensions['width'];
    definition['svg']['height'] = dimensions['height'];
    definition['rect']['stroke']['colour'] = compartment_stroke_colour;
    definition['rect']['stroke']['dash'] = 5;
    definition['name']['show'] = true;
    definition['label']['show'] = true;
    return definition;
}

function drawCompartmentSVG(artifact) {
    let id = artifact['id'];
    let parent_id = "canvas";
    let compartment_id = artifact['id'];
    artifact['parent_id'] = parent_id;
    artifact['compartment_id'] = id;
    console.log('Drawing ' + compartment_artifact + ' : ' + id);

    artifact['display_name'] = artifact['name'];

    let svg = drawArtifact(newCompartmentDefinition(artifact));

    //let rect = svg.select("rect[id='" + id + "']");
    let rect = svg.select("rect[id='" + id + "']");
    console.log(rect);
    let boundingClientRect = rect.node().getBoundingClientRect();
    /*
     Add click event to display properties
     Add Drag Event to allow connector (Currently done a mouse events because SVG does not have drag version)
     Add dragevent versions
     Set common attributes on svg element and children
     */
    svg.on("click", function() {
        loadCompartmentProperties(id);
        d3.event.stopPropagation();
    });
    /*
        .on("dragenter", handleDragEnter)
        .on("dragover", handleDragOver)
        .on("dragleave", handleDragLeave)
        .on("drop", handleDrop)
        .on("dragend", handleDragEnd);
    */

    initialiseCompartmentChildData(id);
}

/*
** Property Sheet Load function
 */
function loadCompartmentProperties(id) {
    $("#properties").load("propertysheets/compartment.html", function () {
        if ('compartments' in okitJson) {
            console.log('Loading ' + compartment_artifact + ' : ' + id);
            let json = okitJson['compartments'];
            for (let i = 0; i < json.length; i++) {
                let compartment = json[i];
                //console.log(JSON.stringify(compartment, null, 2));
                if (compartment['id'] == id) {
                    //console.log('Found Internet Gateway: ' + id);
                    compartment['virtual_cloud_network'] = okitIdsJsonObj[compartment['vcn_id']];
                    $('#name').val(compartment['name']);
                    // Add Event Listeners
                    addPropertiesEventListeners(compartment, []);
                    okitJson['open_compartment_index'] = i;
                    break;
                }
            }
        }
    });
}

/*
** Query OCI
 */

function queryCompartmentAjax() {
    console.log('------------- queryCompartmentAjax --------------------');
    $.ajax({
        type: 'get',
        url: 'oci/artifacts/Compartment',
        dataType: 'text',
        contentType: 'application/json',
        data: JSON.stringify(okitQueryRequestJson),
        success: function(resp) {
            let response_json = [JSON.parse(resp)];
            okitJson['compartments'] = response_json;
            let len =  response_json.length;
            for(let i=0;i<len;i++ ){
                console.log('queryCompartmentAjax : ' + response_json[i]['name']);
                queryVirtualCloudNetworkAjax(response_json[i]['id']);
                queryBlockStorageVolumeAjax(response_json[i]['id'])            }
            redrawSVGCanvas();
            $('#' + compartment_query_cb).prop('checked', true);
            hideQueryProgressIfComplete();
        },
        error: function(xhr, status, error) {
            console.log('Status : '+ status)
            console.log('Error : '+ error)
        }
    });
}

// TODO: Delete
function loadCompartmentPaletteIconSVG() {
    console.log('------------- queryCompartmentAjax --------------------');
    $.ajax({
        type: 'get',
        url: palette_svg[compartment_artifact],
        dataType: 'xml',
        success: function(response) {
            console.log('loadCompartmentPaletteIconSVG Success');
            console.log(response);
            let xml = $(response);
            console.log("XML : " + xml.text());
            let g = xml.find("g");
            console.log("g : " + g.text());
        },
        error: function(xhr, status, error) {
            console.log('loadCompartmentPaletteIconSVG Error : '+ error)
            console.log('loadCompartmentPaletteIconSVG Status : '+ status)
        }
    });
}

$(document).ready(function() {
    clearCompartmentVariables();

    let body = d3.select('#query-progress-tbody');
    let row = body.append('tr');
    let cell = row.append('td');
    cell.append('input')
        .attr('type', 'checkbox')
        .attr('id', compartment_query_cb);
    cell.append('label').text(compartment_artifact);
    //loadCompartmentPaletteIconSVG();
});

