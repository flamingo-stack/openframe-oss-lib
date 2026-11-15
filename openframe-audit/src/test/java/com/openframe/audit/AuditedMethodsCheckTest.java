package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.RootBeanDefinition;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Future;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Named.named;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditedMethodsCheckTest {

    private static final String BEAN = "endpoints";
    private static final String REFUSAL = "@Audited methods that would record nothing or record wrong:\n";

    @Mock private ConfigurableListableBeanFactory beanFactory;
    @InjectMocks private AuditedMethodsCheck check;

    @Test
    void afterSingletonsInstantiated_marksReadParametersResultAndContextVariables_starts() {
        onlySingleton(proxyOf(new TicketEndpoints()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("marksTheProxyCannotIntercept")
    void afterSingletonsInstantiated_markTheProxyCannotIntercept_refusesToStart(Object endpoint, String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> marksTheProxyCannotIntercept() {
        return Stream.of(
                arguments(new ProtectedMark(),
                        "ProtectedMark.archive must be public, not final and not static, or the aspect never sees it"),
                arguments(new FinalMark(),
                        "FinalMark.archive must be public, not final and not static, or the aspect never sees it"),
                arguments(new StaticMark(),
                        "StaticMark.archive must be public, not final and not static, or the aspect never sees it"));
    }

    @Test
    void afterSingletonsInstantiated_markOnlyOnTheInterfaceMethod_refusesToStart() {
        onlySingleton(proxyOf(new InterfaceMarkEndpoint()));

        assertRefusal("InterfaceMarkEndpoint.archive inherits @Audited from an interface or an overridden method,"
                + " which the aspect never sees; put it on the method itself");
    }

    @Test
    void afterSingletonsInstantiated_markedBeanNotProxied_refusesToStart() {
        onlySingleton(new ArchiveEndpoint());

        assertRefusal("ArchiveEndpoint.archive belongs to a bean that is not a Spring proxy, so its calls are never"
                + " recorded");
    }

    @ParameterizedTest
    @MethodSource("asyncResults")
    void afterSingletonsInstantiated_markedMethodReturnsWorkThatFinishesLater_refusesToStart(Object endpoint,
                                                                                             String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> asyncResults() {
        return Stream.of(
                arguments(new FutureResult(), "FutureResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new CompletionStageResult(), "CompletionStageResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new PublisherResult(), "PublisherResult.archive returns work that finishes later,"
                        + " so the event would be written too early"));
    }

    @Test
    void afterSingletonsInstantiated_expressionsNameParametersTheMethodLacks_refusesNamingEachExpression() {
        onlySingleton(proxyOf(new UnknownParameters()));

        assertRefusal("""
                UnknownParameters.archive: '#ticketId' names #ticketId, which the method does not have
                UnknownParameters.archive: '#force' names #force, which the method does not have
                UnknownParameters.archive: '#tenant' names #tenant, which the method does not have
                UnknownParameters.archive: '#title' names #title, which the method does not have
                UnknownParameters.archive: '#organization' names #organization, which the method does not have
                UnknownParameters.archive: '#device' names #device, which the method does not have
                UnknownParameters.archive: '#tag' names #tag, which the method does not have""");
    }

    @Test
    void afterSingletonsInstantiated_detailWithoutKey_refusesToStart() {
        onlySingleton(proxyOf(new DetailWithoutKey()));

        assertRefusal("DetailWithoutKey.addTag: detail '#tagId' has no key, write it as key = expression");
    }

    @Test
    void afterSingletonsInstantiated_problemInAGenericInterfaceImplementation_listsItOnce() {
        onlySingleton(proxyOf(new GenericArchiveEndpoint()));

        assertRefusal("GenericArchiveEndpoint.archive: '#ticketId' names #ticketId, which the method does not have");
    }

    @Test
    void afterSingletonsInstantiated_expressionDoesNotParse_refusesToStart() {
        onlySingleton(proxyOf(new UnparsableExpression()));

        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith(REFUSAL + "UnparsableExpression.archive: '#id +' does not parse: ");
    }

    @Test
    void afterSingletonsInstantiated_voidMethodReadsResult_refusesToStart() {
        onlySingleton(proxyOf(new VoidResult()));

        assertRefusal("VoidResult.archive: '#result' reads #result, but the method returns nothing");
    }

    @Test
    void afterSingletonsInstantiated_problemsInSeveralBeans_refusesListingThemAll() {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {"archiveEndpoint", "voidResult"});
        singleton("archiveEndpoint", new ArchiveEndpoint());
        singleton("voidResult", proxyOf(new VoidResult()));

        assertRefusal("""
                ArchiveEndpoint.archive belongs to a bean that is not a Spring proxy, so its calls are never recorded
                VoidResult.archive: '#result' reads #result, but the method returns nothing""");
    }

    @ParameterizedTest
    @MethodSource("definitionsCreatedOnDemand")
    void afterSingletonsInstantiated_markedBeanCreatedOnDemand_skipsItWithoutCreatingIt(BeanDefinition definition) {
        onlyBeanOfType(ArchiveEndpoint.class);
        when(beanFactory.getBeanDefinition(BEAN)).thenReturn(definition);

        check.afterSingletonsInstantiated();

        verify(beanFactory, never()).getBean(BEAN);
    }

    static Stream<Named<BeanDefinition>> definitionsCreatedOnDemand() {
        RootBeanDefinition prototype = new RootBeanDefinition(ArchiveEndpoint.class);
        prototype.setScope(BeanDefinition.SCOPE_PROTOTYPE);
        RootBeanDefinition lazy = new RootBeanDefinition(ArchiveEndpoint.class);
        lazy.setLazyInit(true);
        return Stream.of(named("prototype", prototype), named("lazy singleton", lazy));
    }

    @Test
    void afterSingletonsInstantiated_beanWithoutMarks_skipsItWithoutCreatingIt() {
        onlyBeanOfType(Unmarked.class);

        check.afterSingletonsInstantiated();

        verify(beanFactory, never()).getBean(BEAN);
    }

    @Test
    void afterSingletonsInstantiated_beanTypeUnknownWithoutCreatingIt_skipsIt() {
        onlyBeanOfType(null);

        check.afterSingletonsInstantiated();

        verify(beanFactory, never()).getBean(BEAN);
    }

    private void assertRefusal(String problems) {
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(REFUSAL + problems);
    }

    private void onlySingleton(Object bean) {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {BEAN});
        singleton(BEAN, bean);
    }

    private void singleton(String name, Object bean) {
        doReturn(bean.getClass()).when(beanFactory).getType(name, false);
        when(beanFactory.getBeanDefinition(name)).thenReturn(new RootBeanDefinition());
        when(beanFactory.getBean(name)).thenReturn(bean);
    }

    private void onlyBeanOfType(Class<?> type) {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {BEAN});
        doReturn(type).when(beanFactory).getType(BEAN, false);
    }

    private static Object proxyOf(Object target) {
        ProxyFactory factory = new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        return factory.getProxy();
    }

    static class TicketEndpoints {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result", details = "title = #title")
        public String create(String title) {
            return title;
        }

        @Audited(action = AuditAction.TICKET_ARCHIVE, details = "ticketIds = #ids.![#root.rawId(#this)]")
        public void archiveAll(List<String> ids) {
        }
    }

    interface Archiver<T> {

        void archive(T id);
    }

    static class GenericArchiveEndpoint implements Archiver<String> {

        @Override
        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#ticketId")
        public void archive(String id) {
        }
    }

    interface MarkedArchiver {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        void archive(String id);
    }

    static class InterfaceMarkEndpoint implements MarkedArchiver {

        @Override
        public void archive(String id) {
        }
    }

    static class ArchiveEndpoint {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }
    }

    static class Unmarked {

        public void archive(String id) {
        }
    }

    static class ProtectedMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        protected void archive(String id) {
        }
    }

    static class FinalMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public final void archive(String id) {
        }
    }

    static class StaticMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public static void archive(String id) {
        }
    }

    static class FutureResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public Future<String> archive(String id) {
            return null;
        }
    }

    static class CompletionStageResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public CompletionStage<String> archive(String id) {
            return null;
        }
    }

    static class PublisherResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public Mono<String> archive(String id) {
            return Mono.empty();
        }
    }

    static class UnknownParameters {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#ticketId", condition = "#force",
                tenantId = "#tenant", targetName = "#title", organizationId = "#organization", deviceId = "#device",
                details = "tagId = #tag")
        public void archive(String id) {
        }
    }

    static class DetailWithoutKey {

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId", details = "#tagId")
        public void addTag(String ticketId, String tagId) {
        }
    }

    static class UnparsableExpression {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id +")
        public void archive(String id) {
        }
    }

    static class VoidResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#result")
        public void archive(String id) {
        }
    }
}
