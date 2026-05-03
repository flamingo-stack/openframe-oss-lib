package com.openframe.management.initializer;

import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
@Order(0)
public class ReleaseVersionMigrationInitializer implements ApplicationRunner {

    private final ReleaseVersionRepository releaseVersionRepository;

    @Override
    public void run(ApplicationArguments args) {
        List<ReleaseVersion> all = new ArrayList<>(releaseVersionRepository.findAll());
        if (all.isEmpty()) {
            log.info("ReleaseVersion migration: no documents found");
            return;
        }
        ReleaseVersion firstDoc = all.get(0);
        String firstDocId = firstDoc.getId();
        if (all.size() == 1 && ReleaseVersion.DEFAULT_ID.equals(firstDocId)) {
            log.info("ReleaseVersion migration: already canonical");
            return;
        }

        ReleaseVersion canonical = all.stream()
                .filter(rv -> {
                    String rvId = rv.getId();
                    return ReleaseVersion.DEFAULT_ID.equals(rvId);
                })
                .findFirst()
                .orElseGet(() -> chooseCanonical(all));

        String canonicalId = canonical.getId();
        String canonicalVersion = canonical.getVersion();
        if (!ReleaseVersion.DEFAULT_ID.equals(canonicalId)) {
            log.info("ReleaseVersion migration: promoting doc id={} version={} to id={}",
                    canonicalId, canonicalVersion, ReleaseVersion.DEFAULT_ID);
            ReleaseVersion replacement = new ReleaseVersion();
            replacement.setId(ReleaseVersion.DEFAULT_ID);
            replacement.setVersion(canonicalVersion);
            releaseVersionRepository.save(replacement);
        }

        for (ReleaseVersion rv : all) {
            String rvId = rv.getId();
            String rvVersion = rv.getVersion();
            if (!ReleaseVersion.DEFAULT_ID.equals(rvId)) {
                releaseVersionRepository.deleteById(rvId);
                log.info("ReleaseVersion migration: deleted legacy doc id={} version={}", rvId, rvVersion);
            }
        }
    }

    private ReleaseVersion chooseCanonical(List<ReleaseVersion> all) {
        return all.stream()
                .min(Comparator.comparing(rv -> {
                    Instant createdAt = rv.getCreatedAt();
                    return createdAt == null ? Instant.MAX : createdAt;
                }))
                .orElseThrow();
    }
}
