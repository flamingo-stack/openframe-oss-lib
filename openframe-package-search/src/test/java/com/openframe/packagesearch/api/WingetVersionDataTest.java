package com.openframe.packagesearch.api;

import com.openframe.packagesearch.api.WingetPackageService.VersionData;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WingetVersionDataTest {

    @Test
    void parsesVersionsAndManifestPaths() {
        String yaml = """
                sV: 1.0
                vD:
                - v: 154.0.1
                  rP: manifests/m/Mozilla/Firefox/154.0.1/f1d3
                  s256H: 1f1d3a631cffd4504f584458bd0ff05788ac397ea066bbdb82b3fecd8a58ea5d
                - v: 154.0
                  aMiV: 3.12.10150.0
                  rP: manifests/m/Mozilla/Firefox/154.0/7bee
                """;

        List<VersionData> versions = WingetPackageService.parseVersionData(yaml);

        assertEquals(2, versions.size());
        assertEquals("154.0.1", versions.getFirst().getVersion());
        assertEquals("manifests/m/Mozilla/Firefox/154.0.1/f1d3", versions.getFirst().getRelativePath());
        // "154.0" must stay a string — a YAML parser would read it as the float 154.0
        assertEquals("154.0", versions.get(1).getVersion());
        assertEquals("manifests/m/Mozilla/Firefox/154.0/7bee", versions.get(1).getRelativePath());
    }

    @Test
    void parsesQuotedVersions() {
        String yaml = """
                sV: 1.0
                vD:
                - v: '4.280'
                  rP: manifests/s/Some/Pkg/4.280/aaaa
                """;

        List<VersionData> versions = WingetPackageService.parseVersionData(yaml);

        assertEquals("4.280", versions.getFirst().getVersion());
    }

    @Test
    void ignoresEntriesWithoutManifestPath() {
        List<VersionData> versions = WingetPackageService.parseVersionData("sV: 1.0\nvD:\n- v: 1.0.0\n");

        assertEquals(0, versions.size());
    }
}
