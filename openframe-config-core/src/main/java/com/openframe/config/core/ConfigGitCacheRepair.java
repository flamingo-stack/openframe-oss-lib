package com.openframe.config.core;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand.ResetType;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.FileSystemUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

/**
 * A pod stopped during a JGit branch switch leaves its PVC clone half checked out or locked, and every later
 * request fails. Spring Cloud Config cannot recover: its unforced checkout throws before force-pull resets.
 * Runs before Tomcat accepts requests, while nothing else can hold the clone.
 */
@Slf4j
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty("spring.cloud.config.server.git.basedir")
public class ConfigGitCacheRepair {

    private static final String GIT_DIR = ".git";
    private static final String LOCK_SUFFIX = ".lock";

    private final Path cacheDir;

    public ConfigGitCacheRepair(@Value("${spring.cloud.config.server.git.basedir}") Path cacheDir) {
        this.cacheDir = cacheDir;
    }

    @PostConstruct
    void repair() {
        Path gitDir = cacheDir.resolve(GIT_DIR);
        if (!Files.isDirectory(gitDir)) {
            return;
        }
        try {
            deleteLocks(gitDir);
            resetIfDirty();
        } catch (IOException | GitAPIException | RuntimeException e) {
            log.warn("Config git cache at {} cannot be repaired, wiping it", cacheDir, e);
            wipe();
        }
    }

    private void deleteLocks(Path gitDir) throws IOException {
        for (Path lock : findLocks(gitDir)) {
            log.warn("Deleting stale config git lock {}", lock);
            Files.delete(lock);
        }
    }

    private List<Path> findLocks(Path gitDir) throws IOException {
        try (Stream<Path> files = Files.walk(gitDir)) {
            return files.filter(Files::isRegularFile)
                    .filter(ConfigGitCacheRepair::isLock)
                    .toList();
        }
    }

    private static boolean isLock(Path file) {
        return file.toString().endsWith(LOCK_SUFFIX);
    }

    private void resetIfDirty() throws IOException, GitAPIException {
        try (Git git = Git.open(cacheDir.toFile())) {
            if (git.status().call().isClean()) {
                return;
            }
            log.warn("Config git cache at {} is dirty, resetting", cacheDir);
            git.reset().setMode(ResetType.HARD).call();
            git.clean().setCleanDirectories(true).setForce(true).call();
        }
    }

    // Spring Cloud Config re-clones on the next request once .git is gone.
    private void wipe() {
        try {
            FileSystemUtils.deleteRecursively(cacheDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot wipe config git cache at " + cacheDir, e);
        }
    }
}
