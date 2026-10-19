package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantSoftwareCveAggregatorTest {

    private static final String TENANT = "tenant-1";
    private static final Long TITLE = 42L;

    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private TenantSoftwareRepository tenantSoftwareRepository;

    @InjectMocks private TenantSoftwareCveAggregator aggregator;

    private DeviceCve deviceCve(String cveId) {
        return DeviceCve.builder().cveId(cveId).build();
    }

    @Test
    void recompute_withNullKeys_isNoOp() {
        aggregator.recompute(null, TITLE);
        aggregator.recompute(TENANT, null);
        verifyNoInteractions(deviceCveRepository, tenantSoftwareRepository);
    }

    @Test
    void recompute_whenTenantSoftwareNotProjectedYet_isNoOp() {
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(Optional.empty());

        aggregator.recompute(TENANT, TITLE);

        verify(tenantSoftwareRepository, never()).save(any());
        verifyNoInteractions(deviceCveRepository);
    }

    @Test
    void recompute_countsDistinctCvesAndSavesWhenChanged() {
        TenantSoftware ts = TenantSoftware.builder().tenantId(TENANT).softwareTitleId(TITLE).cveCount(0).build();
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(Optional.of(ts));
        when(deviceCveRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(List.of(
                deviceCve("CVE-1"), deviceCve("CVE-2"), deviceCve("CVE-1")));   // CVE-1 duplicated across devices

        aggregator.recompute(TENANT, TITLE);

        assertThat(ts.getCveCount()).isEqualTo(2);
        assertThat(ts.getUpdatedAt()).isNotNull();
        verify(tenantSoftwareRepository).save(ts);
    }

    @Test
    void recompute_whenCountUnchanged_doesNotSave() {
        TenantSoftware ts = TenantSoftware.builder().tenantId(TENANT).softwareTitleId(TITLE).cveCount(1).build();
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(Optional.of(ts));
        when(deviceCveRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(List.of(deviceCve("CVE-1")));

        aggregator.recompute(TENANT, TITLE);

        verify(tenantSoftwareRepository, never()).save(any());
    }

    @Test
    void recompute_withNoCves_clearsCount() {
        TenantSoftware ts = TenantSoftware.builder().tenantId(TENANT).softwareTitleId(TITLE).cveCount(3).build();
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(Optional.of(ts));
        when(deviceCveRepository.findByTenantIdAndSoftwareTitleId(TENANT, TITLE)).thenReturn(List.of());

        aggregator.recompute(TENANT, TITLE);

        assertThat(ts.getCveCount()).isZero();
        verify(tenantSoftwareRepository).save(ts);
    }
}
