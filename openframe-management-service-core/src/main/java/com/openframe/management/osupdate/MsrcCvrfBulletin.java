package com.openframe.management.osupdate;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

// What the enrichment reads from one monthly MSRC bulletin.
@Value
@Builder
public class MsrcCvrfBulletin {

    Map<String, MsrcKbArticle> kbArticles;
    // Windows version as the agent reports it ("11 24H2") to its highest fixed build ("26100.9974").
    Map<String, String> latestWindowsBuilds;
}
