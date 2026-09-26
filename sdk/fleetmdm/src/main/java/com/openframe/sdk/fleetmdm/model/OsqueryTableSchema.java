package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OsqueryTableSchema {

    private String name;
    private List<String> platforms;
    private String description;
    private List<OsqueryColumnSchema> columns;
    private String examples;
    private String notes;
    private String url;
    private boolean evented;
    private boolean cacheable;
}
