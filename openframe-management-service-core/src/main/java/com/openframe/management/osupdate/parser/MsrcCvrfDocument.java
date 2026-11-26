package com.openframe.management.osupdate.parser;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Only the parts of an MSRC CVRF v3.0 document the enrichment reads.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
class MsrcCvrfDocument {

    @JsonProperty("ProductTree")
    private MsrcCvrfProductTree msrcCvrfProductTree;

    @JsonProperty("Vulnerability")
    private List<MsrcCvrfVulnerability> msrcCvrfVulnerabilities;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MsrcCvrfProductTree {

        @JsonProperty("FullProductName")
        private List<MsrcCvrfProduct> msrcCvrfProducts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MsrcCvrfProduct {

        @JsonProperty("ProductID")
        private String productId;

        @JsonProperty("Value")
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MsrcCvrfVulnerability {

        @JsonProperty("CVE")
        private String cve;

        @JsonProperty("Threats")
        private List<MsrcCvrfEntry> threats;

        @JsonProperty("Remediations")
        private List<MsrcCvrfEntry> remediations;
    }

    // A threat or a remediation: both are a typed description of some products.
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MsrcCvrfEntry {

        @JsonProperty("Type")
        private Integer type;

        @JsonProperty("Description")
        private MsrcCvrfDescription msrcCvrfDescription;

        @JsonProperty("ProductID")
        private List<String> productIds;

        // Only on a remediation; the version of whatever the fix is for, an OS build only for an OS product.
        @JsonProperty("FixedBuild")
        private String fixedBuild;

        // Only on a remediation: the kind of the fix.
        @JsonProperty("SubType")
        private String subType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MsrcCvrfDescription {

        @JsonProperty("Value")
        private String value;
    }
}
