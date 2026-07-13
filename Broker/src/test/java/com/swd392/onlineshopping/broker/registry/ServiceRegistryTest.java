package com.swd392.onlineshopping.broker.registry;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ServiceRegistryTest {

    private ServiceRegistry registry;
    private RegistryProperties properties;

    @BeforeEach
    void setUp() {
        properties = new RegistryProperties();
        registry = new ServiceRegistry(properties);
    }

    private ServiceRegistration reg(String serviceId, String name, int port) {
        return new ServiceRegistration(serviceId, name, "1.0", "localhost", port,
                "http://localhost:" + port, "http://localhost:" + port + "/actuator/health",
                List.of("placeHold", "captureHold"));
    }

    @Test
    void dangKyRoiTraCuuDuocTheoTen() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        var found = registry.findByName("CustomerAccountService");

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getBaseUrl()).isEqualTo("http://localhost:8081");
        assertThat(found.get(0).getStatus()).isEqualTo("UP");
    }

    @Test
    void traCuuTenKhongTonTai_thiTraVeRong_khongPhaiLoi() {
        assertThat(registry.findByName("KhongCoService")).isEmpty();
    }

    @Test
    void traCuuTheoNghiepVu_yellowPages() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));
        registry.register(reg("id-2", "CatalogService", 8082));

        assertThat(registry.findByOperation("placeHold")).hasSize(2);
        assertThat(registry.findByOperation("khongCoNghiepVuNay")).isEmpty();
    }

    @Test
    void heartbeat_serviceLa_thiTraVeFalse_deServiceTuDangKyLai() {
        assertThat(registry.heartbeat("id-khong-quen-biet")).isFalse();
    }

    @Test
    void heartbeat_serviceDaDangKy_thiThanhCong() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        assertThat(registry.heartbeat("id-1")).isTrue();
    }

    @Test
    void huyDangKy_thiKhongConTraCuuThayNua() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        assertThat(registry.deregister("id-1")).isTrue();
        assertThat(registry.findByName("CustomerAccountService")).isEmpty();
    }

    @Test
    void serviceChetKhongGuiHeartbeat_thiBiLoaiKhoiRegistry() {
        properties.setHeartbeatTtlSeconds(0); // het han ngay lap tuc
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        registry.evictExpired();

        assertThat(registry.findByName("CustomerAccountService")).isEmpty();
    }

    @Test
    void serviceConSong_thiKhongBiLoai() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        registry.evictExpired(); // TTL mac dinh 90s -> chua het han

        assertThat(registry.findByName("CustomerAccountService")).hasSize(1);
    }

    @Test
    void dangKyLaiCungServiceId_thiKhongTaoBanGhiTrung() {
        registry.register(reg("id-1", "CustomerAccountService", 8081));
        registry.register(reg("id-1", "CustomerAccountService", 8081));

        assertThat(registry.findAll()).hasSize(1);
    }
}