package com.openframe.packagesearch.api;

import com.openframe.packagesearch.api.ChocoFeedParser.ChocoEntry;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChocoFeedParserTest {

    private static final String FEED = """
            <?xml version="1.0" encoding="utf-8" standalone="yes"?>
            <feed xml:base="https://community.chocolatey.org/api/v2/"
                  xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
                  xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"
                  xmlns="http://www.w3.org/2005/Atom">
              <title type="text">Search</title>
              <entry>
                <id>https://community.chocolatey.org/api/v2/Packages(Id='Firefox',Version='154.0.1')</id>
                <title type="text">Firefox</title>
                <summary type="text">Mozilla Firefox is a free web browser.</summary>
                <author><name>Mozilla</name></author>
                <m:properties>
                  <d:Version>154.0.1</d:Version>
                  <d:Title>Mozilla Firefox</d:Title>
                  <d:Description>Long markdown description.</d:Description>
                  <d:DownloadCount m:type="Edm.Int32">111542376</d:DownloadCount>
                  <d:IconUrl>https://example.com/firefox.png</d:IconUrl>
                  <d:ProjectUrl>https://www.mozilla.org/firefox</d:ProjectUrl>
                  <d:Tags>browser mozilla firefox</d:Tags>
                  <d:Published m:type="Edm.DateTime">2026-08-20T10:30:00</d:Published>
                  <d:IsPrerelease m:type="Edm.Boolean">false</d:IsPrerelease>
                </m:properties>
              </entry>
              <entry>
                <id>https://community.chocolatey.org/api/v2/Packages(Id='bare',Version='1.0.0')</id>
                <title type="text">bare</title>
                <m:properties>
                  <d:Version>1.0.0</d:Version>
                  <d:IconUrl m:null="true"/>
                </m:properties>
              </entry>
            </feed>
            """;

    @Test
    void parsesEntries() {
        List<ChocoEntry> entries = ChocoFeedParser.parse(FEED);

        assertEquals(2, entries.size());
        ChocoEntry firefox = entries.getFirst();
        assertEquals("Firefox", firefox.getId());
        assertEquals("Mozilla Firefox", firefox.getTitle());
        assertEquals("Mozilla Firefox is a free web browser.", firefox.getSummary());
        assertEquals("154.0.1", firefox.getVersion());
        assertEquals(111542376, firefox.getDownloadCount());
        assertEquals("https://example.com/firefox.png", firefox.getIconUrl());
        assertEquals("browser mozilla firefox", firefox.getTags());
        assertEquals(Instant.parse("2026-08-20T10:30:00Z"), firefox.getPublished());
        assertEquals(false, firefox.getPrerelease());
    }

    @Test
    void missingAndNullPropertiesBecomeNull() {
        ChocoEntry bare = ChocoFeedParser.parse(FEED).get(1);

        assertEquals("bare", bare.getId());
        assertNull(bare.getTitle());
        assertNull(bare.getSummary());
        assertNull(bare.getDownloadCount());
        assertNull(bare.getIconUrl());
        assertNull(bare.getPublished());
    }

    @Test
    void rejectsDoctypeToPreventXxe() {
        String malicious = """
                <?xml version="1.0"?>
                <!DOCTYPE feed [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
                <feed xmlns="http://www.w3.org/2005/Atom"><entry><title>&xxe;</title></entry></feed>
                """;

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> ChocoFeedParser.parse(malicious));
        assertTrue(error.getMessage().contains("Chocolatey"));
    }
}
