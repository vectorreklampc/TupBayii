namespace TupBayiProje.Moduller.Audit.Altyapi;

public sealed class KararKimligi : IEquatable<KararKimligi>
{
    internal KararKimligi(Guid deger) => Deger = deger;

    internal Guid Deger { get; }

    internal Guid TestDegeri => Deger;

    public bool Equals(KararKimligi? other) => other is not null && Deger == other.Deger;

    public override bool Equals(object? obj) => obj is KararKimligi other && Equals(other);

    public override int GetHashCode() => Deger.GetHashCode();
}

public sealed class CorrelationKimligi : IEquatable<CorrelationKimligi>
{
    internal CorrelationKimligi(Guid deger) => Deger = deger;

    internal Guid Deger { get; }

    internal Guid TestDegeri => Deger;

    public bool Equals(CorrelationKimligi? other) => other is not null && Deger == other.Deger;

    public override bool Equals(object? obj) => obj is CorrelationKimligi other && Equals(other);

    public override int GetHashCode() => Deger.GetHashCode();
}
