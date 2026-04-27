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
        if (all.size() == 1 && ReleaseVersion.DEFAULT_ID.equals(all.get(0).getId())) {
            log.info("ReleaseVersion migration: already canonical");
            return;
        }

        ReleaseVersion canonical = all.stream()
                .filter(rv -> ReleaseVersion.DEFAULT_ID.equals(rv.getId()))
                .findFirst()
                .orElseGet(() -> chooseCanonical(all));

        if (!ReleaseVersion.DEFAULT_ID.equals(canonical.getId())) {
            log.info("ReleaseVersion migration: promoting doc id={} version={} to id={}",
                    canonical.getId(), canonical.getVersion(), ReleaseVersion.DEFAULT_ID);
            ReleaseVersion replacement = new ReleaseVersion();
            replacement.setId(ReleaseVersion.DEFAULT_ID);
            replacement.setVersion(canonical.getVersion());
            releaseVersionRepository.save(replacement);
        }

        for (ReleaseVersion rv : all) {
            if (!ReleaseVersion.DEFAULT_ID.equals(rv.getId())) {
                releaseVersionRepository.deleteById(rv.getId());
                log.info("ReleaseVersion migration: deleted legacy doc id={} version={}", rv.getId(), rv.getVersion());
            }
        }
    }

    private ReleaseVersion chooseCanonical(List<ReleaseVersion> all) {
        return all.stream()
                .min(Comparator.comparing(rv -> rv.getCreatedAt() == null ? Instant.MAX : rv.getCreatedAt()))
                .orElseThrow();
    }
}
