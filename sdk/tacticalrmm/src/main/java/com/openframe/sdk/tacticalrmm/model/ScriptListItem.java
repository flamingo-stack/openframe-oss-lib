package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Script list item model for Tactical RMM API responses
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptListItem {
    
    @JsonProperty("id")
    private Integer id;
    
    @JsonProperty("name")
    private String name;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return "ScriptListItem{" +
                "id=" + id +
                ", name='" + name + '\'' +
                '}';
    }
}
