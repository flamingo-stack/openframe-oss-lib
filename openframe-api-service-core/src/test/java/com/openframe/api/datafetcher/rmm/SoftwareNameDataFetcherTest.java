package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.vulnerability.AffectedSoftwareResponse;
import com.openframe.core.util.SoftwareNames;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SoftwareNameDataFetcherTest {

    private final SoftwareNameDataFetcher fetcher = new SoftwareNameDataFetcher();

    @Test
    void softwareName_visibleName_isKept() {
        SoftwareResponse software = SoftwareResponse.builder().name("Google Chrome").bundleIdentifier("com.google.Chrome").build();

        assertThat(fetcher.softwareName(source(software))).isEqualTo("Google Chrome");
    }

    @Test
    void softwareName_invisibleName_showsTheBundleIdentifier() {
        SoftwareResponse software = SoftwareResponse.builder().name("\u200B").bundleIdentifier("com.apple.SettingsPlaceholder").build();

        assertThat(fetcher.softwareName(source(software))).isEqualTo("com.apple.SettingsPlaceholder");
    }

    @Test
    void softwareName_nothingVisible_isUnnamed() {
        SoftwareResponse software = SoftwareResponse.builder().name(" ").build();

        assertThat(fetcher.softwareName(source(software))).isEqualTo(SoftwareNames.UNNAMED);
    }

    @Test
    void affectedSoftwareName_invisibleName_showsTheBundleIdentifier() {
        AffectedSoftwareResponse software = AffectedSoftwareResponse.builder()
                .name("\uFEFF").bundleIdentifier("com.apple.WidgetRenderer").build();

        assertThat(fetcher.affectedSoftwareName(source(software))).isEqualTo("com.apple.WidgetRenderer");
    }

    private static DgsDataFetchingEnvironment source(Object software) {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        when(dfe.getSource()).thenReturn(software);
        return dfe;
    }
}
