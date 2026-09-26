package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OsqueryColumnSchema {

    private String name;
    private String type;
    private String description;
    private List<String> platforms;
    private String notes;
    private boolean required;
    private Boolean hidden;
    private Boolean index;
}
