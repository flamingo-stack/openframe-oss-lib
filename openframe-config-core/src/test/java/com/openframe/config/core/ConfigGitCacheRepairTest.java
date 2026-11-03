package com.openframe.config.core;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class ConfigGitCacheRepairTest {

    private static final String CONFIG_FILE = "application.yml";
    private static final String MAIN = "main";
    private static final String PR_BRANCH = "pr";
    private static final String MAIN_CONTENT = "branch: main\n";
    private static final String PR_CONTENT = "branch: pr\n";
    private static final String BASEDIR_PROPERTY = "spring.cloud.config.server.git.basedir";

    @TempDir
    private Path tempDir;

    private Path remote;
    private Path cache;
    private ConfigGitCacheRepair repair;

    @BeforeEach
    void setUp() throws IOException, GitAPIException {
        remote = tempDir.resolve("remote");
        cache = tempDir.resolve("cache");
        repair = new ConfigGitCacheRepair(cache);
        createRemoteWithTwoBranches();
        cloneRemoteToCache();
    }

    @Test
    void repair_halfFinishedBranchSwitchWithStaleLock_nextCheckoutSucceeds() throws IOException, GitAPIException {
        // setup
        Files.writeString(cache.resolve(CONFIG_FILE), "half written\n");
        Files.createFile(cache.resolve(".git/index.lock"));

        // execution
        repair.repair();

        // verifications
        checkout(PR_BRANCH);
        assertThat(cache.resolve(CONFIG_FILE)).hasContent(PR_CONTENT);
    }

    @Test
    void repair_halfFinishedBranchSwitch_nextCheckoutSucceeds() throws IOException, GitAPIException {
        // setup
        Files.writeString(cache.resolve(CONFIG_FILE), "half written\n");

        // execution
        repair.repair();

        // verifications
        checkout(PR_BRANCH);
        assertThat(cache.resolve(CONFIG_FILE)).hasContent(PR_CONTENT);
    }

    @ParameterizedTest
    @ValueSource(strings = {"index.lock", "HEAD.lock"})
    void repair_staleLockOnCleanTree_nextCheckoutSucceeds(String lock) throws IOException, GitAPIException {
        // setup
        Files.createFile(cache.resolve(".git").resolve(lock));

        // execution
        repair.repair();

        // verifications
        checkout(PR_BRANCH);
        assertThat(cache.resolve(CONFIG_FILE)).hasContent(PR_CONTENT);
    }

    @Test
    void repair_untrackedFile_removed() throws IOException {
        // setup
        Path untracked = Files.writeString(cache.resolve("left-from-pr.yml"), "stale: true\n");

        // execution
        repair.repair();

        // verifications
        assertThat(untracked).doesNotExist();
    }

    @Test
    void repair_dirtyCache_warnsAboutReset(CapturedOutput output) throws IOException {
        // setup
        Files.writeString(cache.resolve(CONFIG_FILE), "half written\n");

        // execution
        repair.repair();

        // verifications
        assertThat(output).contains("is dirty, resetting");
    }

    @Test
    void repair_healthyCache_changesNothingAndStaysQuiet(CapturedOutput output) {
        // execution
        repair.repair();

        // verifications
        assertThat(cache.resolve(CONFIG_FILE)).hasContent(MAIN_CONTENT);
        assertThat(output).doesNotContain("Config git");
    }

    @Test
    void repair_emptyCacheDirectory_keepsItUntouched(CapturedOutput output) throws IOException {
        // setup
        Path emptyCache = Files.createDirectory(tempDir.resolve("empty"));

        // execution
        new ConfigGitCacheRepair(emptyCache).repair();

        // verifications
        assertThat(emptyCache).isEmptyDirectory();
        assertThat(output).doesNotContain("Config git");
    }

    @Test
    void repair_missingCacheDirectory_doesNothing(CapturedOutput output) {
        // setup
        Path missingCache = tempDir.resolve("missing");

        // execution
        new ConfigGitCacheRepair(missingCache).repair();

        // verifications
        assertThat(missingCache).doesNotExist();
        assertThat(output).doesNotContain("Config git");
    }

    @Test
    void repair_corruptRepository_wipesCacheForReclone() throws IOException {
        // setup
        Files.writeString(cache.resolve(".git/HEAD"), "not a ref\n");
        Files.delete(cache.resolve(".git/config"));
        Path objects = cache.resolve(".git/objects");
        Files.move(objects, tempDir.resolve("moved-objects"));

        // execution
        repair.repair();

        // verifications
        assertThat(cache).doesNotExist();
    }

    @Test
    void context_basedirSet_createsRepair() {
        // setup
        ApplicationContextRunner runner = contextRunner()
                .withPropertyValues(BASEDIR_PROPERTY + "=" + cache);

        // execution
        runner.run(context ->
                // verifications
                assertThat(context).hasSingleBean(ConfigGitCacheRepair.class));
    }

    @Test
    void context_basedirNotSet_skipsRepair() {
        // setup
        ApplicationContextRunner runner = contextRunner();

        // execution
        runner.run(context ->
                // verifications
                assertThat(context).doesNotHaveBean(ConfigGitCacheRepair.class));
    }

    private ApplicationContextRunner contextRunner() {
        return new ApplicationContextRunner().withUserConfiguration(ConfigGitCacheRepair.class);
    }

    private void createRemoteWithTwoBranches() throws IOException, GitAPIException {
        Files.createDirectories(remote);
        try (Git git = Git.init().setDirectory(remote.toFile()).setInitialBranch(MAIN).call()) {
            commit(git, MAIN_CONTENT);
            git.branchCreate().setName(PR_BRANCH).call();
            git.checkout().setName(PR_BRANCH).call();
            commit(git, PR_CONTENT);
            git.checkout().setName(MAIN).call();
        }
    }

    private void commit(Git git, String content) throws IOException, GitAPIException {
        Files.writeString(remote.resolve(CONFIG_FILE), content);
        git.add().addFilepattern(".").call();
        git.commit().setMessage("configs").setSign(false).setAuthor("test", "test@example.com")
                .setCommitter("test", "test@example.com").call();
    }

    private void cloneRemoteToCache() throws GitAPIException {
        String uri = remote.toUri().toString();
        try (Git git = Git.cloneRepository().setURI(uri).setDirectory(cache.toFile()).call()) {
            git.branchCreate().setName(PR_BRANCH).setStartPoint("origin/" + PR_BRANCH).call();
        }
    }

    private void checkout(String branch) throws IOException, GitAPIException {
        try (Git git = Git.open(cache.toFile())) {
            git.checkout().setName(branch).call();
        }
    }
}
