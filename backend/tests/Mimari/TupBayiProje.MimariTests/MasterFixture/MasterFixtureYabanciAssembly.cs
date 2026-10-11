using System.Reflection;
using System.Reflection.Emit;

namespace TupBayiProje.MimariTests.MasterFixture;

// Negatif ornek: fixture Kullanici ile ayni tam ad (namespace + kisa ad) ve Guid Id ozelligini tasiyan,
// ayri bir dinamik assembly'de uretilmis tip. Izinli tipin yerine gecmesi oracle tarafindan FAIL edilmelidir.
public static class YabanciAssembly
{
    public const string AssemblyAdi = "TupBayiProje.MimariTests.YabanciAssembly";

    public static Type Kullanici { get; } = KullaniciUret();

    private static Type KullaniciUret()
    {
        var assembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName(AssemblyAdi), AssemblyBuilderAccess.Run);
        var tip = assembly.DefineDynamicModule(AssemblyAdi).DefineType(
            typeof(Kullanici).FullName!,
            TypeAttributes.Public | TypeAttributes.Sealed | TypeAttributes.Class);
        tip.DefineDefaultConstructor(MethodAttributes.Public);

        var alan = tip.DefineField("id", typeof(Guid), FieldAttributes.Private);
        const MethodAttributes erisim = MethodAttributes.Public | MethodAttributes.SpecialName | MethodAttributes.HideBySig;

        var getter = tip.DefineMethod("get_Id", erisim, typeof(Guid), Type.EmptyTypes);
        var getterIl = getter.GetILGenerator();
        getterIl.Emit(OpCodes.Ldarg_0);
        getterIl.Emit(OpCodes.Ldfld, alan);
        getterIl.Emit(OpCodes.Ret);

        var setter = tip.DefineMethod("set_Id", erisim, null, [typeof(Guid)]);
        var setterIl = setter.GetILGenerator();
        setterIl.Emit(OpCodes.Ldarg_0);
        setterIl.Emit(OpCodes.Ldarg_1);
        setterIl.Emit(OpCodes.Stfld, alan);
        setterIl.Emit(OpCodes.Ret);

        var ozellik = tip.DefineProperty("Id", PropertyAttributes.None, typeof(Guid), null);
        ozellik.SetGetMethod(getter);
        ozellik.SetSetMethod(setter);

        return tip.CreateType();
    }
}
