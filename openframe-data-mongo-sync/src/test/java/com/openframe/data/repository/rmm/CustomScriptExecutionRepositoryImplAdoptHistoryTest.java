package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CustomScriptExecutionRepositoryImplAdoptHistoryTest {

    private static final String TENANT = "t1";

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks private CustomScriptExecutionRepositoryImpl repository;

    private ExecutionOwnerScope chocoAdopt;

    @BeforeEach
    void setUp() {
        chocoAdopt = ExecutionOwnerScope.forSoftware(PackageManagerType.CHOCO, "googlechrome", SoftwareAction.ADOPT);
    }

    @Test
    void count_adoptHistory_scopedByThePackageAndActionNotByAScript() {
        // setup
        ExecutionOwnerScope owner = chocoAdopt;

        // execution
        repository.count(TENANT, owner, null, null);

        // verifications
        verify(mongoTemplate).count(queryCaptor.capture(), eq(ScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT)
                .containsEntry("packageManager", PackageManagerType.CHOCO)
                .containsEntry("packageName", "googlechrome")
                .containsEntry("softwareAction", SoftwareAction.ADOPT)
                .doesNotContainKey("scriptId");
    }

    @Test
    void findPage_adoptHistory_scopedByThePackageAndActionNotByAScript() {
        // setup
        ExecutionOwnerScope owner = chocoAdopt;

        // execution
        repository.findPage(TENANT, owner, null, "dispatchedAt", Sort.Direction.DESC, null, false, 21, null);

        // verifications
        verify(mongoTemplate).find(queryCaptor.capture(), eq(ScriptExecution.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("softwareAction", SoftwareAction.ADOPT)
                .doesNotContainKey("scriptId");
    }
}
