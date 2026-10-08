using System.Collections;
using System.Data;
using System.Data.Common;
using System.Diagnostics.CodeAnalysis;
using TupBayiProje.Moduller.Inventory.Altyapi;
using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Uygulama;
using Xunit;

namespace TupBayiProje.Inventory.BirimTests;

public sealed class StokHareketiPostgreSqlDeposuTests
{
    [Fact]
    public async Task AtomikKaydetBasariliysaTekTransactionCommitEder()
    {
        var baglanti = new KayitliDbConnection([1, 1, 1, 1]);
        var depo = new StokHareketiPostgreSqlDeposu((_, _) => ValueTask.FromResult<DbConnection>(baglanti));

        var sonuc = await depo.AtomikKaydetAsync(
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            "idem-1",
            GecerliHareket());

        Assert.Equal(StokHareketiDepoSonucu.Kaydedildi, sonuc);
        Assert.True(baglanti.Transaction.CommitEdildi);
        Assert.False(baglanti.Transaction.RollbackEdildi);
        Assert.Contains(baglanti.Komutlar, komut => komut.Contains("stok_hareketleri", StringComparison.Ordinal));
        Assert.Contains(baglanti.Komutlar, komut => komut.Contains("miktar >=", StringComparison.Ordinal));
    }

    [Fact]
    public async Task AtomikKaydetKaynakYetersizseMovementYazmadanRollbackEder()
    {
        var baglanti = new KayitliDbConnection([1, 0]);
        var depo = new StokHareketiPostgreSqlDeposu((_, _) => ValueTask.FromResult<DbConnection>(baglanti));

        var sonuc = await depo.AtomikKaydetAsync(
            StokIslemBaglami.Olustur("tenant-1", "kullanici-1"),
            "idem-1",
            GecerliHareket());

        Assert.Equal(StokHareketiDepoSonucu.KaynakStokYetersiz, sonuc);
        Assert.False(baglanti.Transaction.CommitEdildi);
        Assert.True(baglanti.Transaction.RollbackEdildi);
        Assert.DoesNotContain(baglanti.Komutlar, komut => komut.Contains("INSERT INTO stok_hareketleri", StringComparison.Ordinal));
    }

    private static StokHareketi GecerliHareket() =>
        StokHareketi.Olustur(
            "hareket-1",
            "urun-1",
            TupDurumu.Dolu,
            StokLokasyonu.Olustur(StokLokasyonTuru.Depo, "depo-1"),
            StokLokasyonu.Olustur(StokLokasyonTuru.Arac, "arac-1"),
            1,
            DateTimeOffset.UtcNow);

    private sealed class KayitliDbConnection(IEnumerable<int> sonuclar) : DbConnection
    {
        private readonly Queue<int> sonuclar = new(sonuclar);
        private ConnectionState durum = ConnectionState.Closed;

        [AllowNull]
        public override string ConnectionString { get; set; } = "Host=sahte";

        public override string Database => "tenant";

        public override string DataSource => "sahte";

        public override string ServerVersion => "1";

        public override ConnectionState State => durum;

        public List<string> Komutlar { get; } = [];

        public KayitliDbTransaction Transaction { get; private set; } = null!;

        public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();

        public override void Close() => durum = ConnectionState.Closed;

        public override void Open() => durum = ConnectionState.Open;

        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) =>
            Transaction = new KayitliDbTransaction(this, isolationLevel);

        protected override DbCommand CreateDbCommand() => new KayitliDbCommand(this, sonuclar);
    }

    private sealed class KayitliDbTransaction(DbConnection connection, IsolationLevel isolationLevel)
        : DbTransaction
    {
        public bool CommitEdildi { get; private set; }

        public bool RollbackEdildi { get; private set; }

        public override IsolationLevel IsolationLevel { get; } = isolationLevel;

        protected override DbConnection DbConnection { get; } = connection;

        public override void Commit() => CommitEdildi = true;

        public override void Rollback() => RollbackEdildi = true;
    }

    private sealed class KayitliDbCommand(KayitliDbConnection connection, Queue<int> sonuclar)
        : DbCommand
    {
        private readonly KayitliDbParameterCollection parameters = new();

        [AllowNull]
        public override string CommandText { get; set; } = string.Empty;

        public override int CommandTimeout { get; set; }

        public override CommandType CommandType { get; set; } = CommandType.Text;

        public override bool DesignTimeVisible { get; set; }

        public override UpdateRowSource UpdatedRowSource { get; set; }

        [AllowNull]
        protected override DbConnection DbConnection { get; set; } = connection;

        protected override DbParameterCollection DbParameterCollection => parameters;

        protected override DbTransaction? DbTransaction { get; set; }

        public override void Cancel() => throw new NotSupportedException();

        public override int ExecuteNonQuery()
        {
            connection.Komutlar.Add(CommandText);
            return sonuclar.Dequeue();
        }

        public override object? ExecuteScalar() => throw new NotSupportedException();

        public override void Prepare()
        {
        }

        protected override DbParameter CreateDbParameter() => new KayitliDbParameter();

        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) =>
            throw new NotSupportedException();
    }

    private sealed class KayitliDbParameter : DbParameter
    {
        public override DbType DbType { get; set; }

        public override ParameterDirection Direction { get; set; }

        public override bool IsNullable { get; set; }

        [AllowNull]
        public override string ParameterName { get; set; } = string.Empty;

        public override int Size { get; set; }

        [AllowNull]
        public override string SourceColumn { get; set; } = string.Empty;

        public override bool SourceColumnNullMapping { get; set; }

        public override object? Value { get; set; }

        public override void ResetDbType()
        {
        }
    }

    private sealed class KayitliDbParameterCollection : DbParameterCollection
    {
        private readonly List<DbParameter> items = [];

        public override int Count => items.Count;

        public override object SyncRoot => ((ICollection)items).SyncRoot;

        public override int Add(object value)
        {
            items.Add((DbParameter)value);
            return items.Count - 1;
        }

        public override void AddRange(Array values)
        {
            foreach (var value in values)
            {
                Add(value!);
            }
        }

        public override void Clear() => items.Clear();

        public override bool Contains(object value) => items.Contains((DbParameter)value);

        public override bool Contains(string value) => IndexOf(value) >= 0;

        public override void CopyTo(Array array, int index) => ((ICollection)items).CopyTo(array, index);

        public override IEnumerator GetEnumerator() => items.GetEnumerator();

        public override int IndexOf(object value) => items.IndexOf((DbParameter)value);

        public override int IndexOf(string parameterName) =>
            items.FindIndex(item => StringComparer.Ordinal.Equals(item.ParameterName, parameterName));

        public override void Insert(int index, object value) => items.Insert(index, (DbParameter)value);

        public override void Remove(object value) => items.Remove((DbParameter)value);

        public override void RemoveAt(int index) => items.RemoveAt(index);

        public override void RemoveAt(string parameterName) => items.RemoveAt(IndexOf(parameterName));

        protected override DbParameter GetParameter(int index) => items[index];

        protected override DbParameter GetParameter(string parameterName) => items[IndexOf(parameterName)];

        protected override void SetParameter(int index, DbParameter value) => items[index] = value;

        protected override void SetParameter(string parameterName, DbParameter value) =>
            items[IndexOf(parameterName)] = value;
    }
}
