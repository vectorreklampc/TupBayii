CREATE TABLE IF NOT EXISTS stok_idempotency
(
    operation_type text NOT NULL,
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    hareket_kimligi text NOT NULL,
    PRIMARY KEY (operation_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS stok_projection
(
    urun_kimligi text NOT NULL,
    tup_durumu text NOT NULL CHECK (tup_durumu IN ('FULL', 'EMPTY')),
    lokasyon_turu text NOT NULL CHECK (lokasyon_turu IN ('WAREHOUSE', 'VEHICLE', 'CUSTOMER')),
    lokasyon_kimligi text NOT NULL,
    miktar integer NOT NULL CHECK (miktar >= 0),
    PRIMARY KEY (urun_kimligi, tup_durumu, lokasyon_turu, lokasyon_kimligi)
);

CREATE TABLE IF NOT EXISTS stok_hareketleri
(
    hareket_kimligi text PRIMARY KEY,
    urun_kimligi text NOT NULL,
    tup_durumu text NOT NULL CHECK (tup_durumu IN ('FULL', 'EMPTY')),
    kaynak_turu text NOT NULL CHECK (kaynak_turu IN ('WAREHOUSE', 'VEHICLE', 'CUSTOMER')),
    kaynak_kimligi text NOT NULL,
    hedef_turu text NOT NULL CHECK (hedef_turu IN ('WAREHOUSE', 'VEHICLE', 'CUSTOMER')),
    hedef_kimligi text NOT NULL,
    miktar integer NOT NULL CHECK (miktar > 0),
    olusturulma_zamani timestamp with time zone NOT NULL,
    CHECK ((kaynak_turu, kaynak_kimligi) <> (hedef_turu, hedef_kimligi))
);

CREATE OR REPLACE FUNCTION tamamlanmis_stok_hareketini_koru()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Tamamlanmis stok hareketi degistirilemez veya silinemez.';
END;
$$;

DROP TRIGGER IF EXISTS stok_hareketi_degistirme_engeli ON stok_hareketleri;
CREATE TRIGGER stok_hareketi_degistirme_engeli
BEFORE UPDATE OR DELETE ON stok_hareketleri
FOR EACH ROW
EXECUTE FUNCTION tamamlanmis_stok_hareketini_koru();
