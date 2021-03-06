/** External Modules **/
const express = require("express");
var _ = require("lodash");

/** Internal Modules **/
const {
  categoria,
  subcategoria,
  movimentacao,
  tipos_mov,
  sequelize,
  Sequelize,
} = require("../models");

const router = express.Router();

/*
 * GET
 */

/** Dashboard Entradas **/
router.post("/dashboard", async (req, res) => {
  const { ano } = req.body;

  if (!ano) return res.status(400).send({ error: "Ano é obrigatório" });

  try {
    const entradaCategoriasSql = `
    select "categoria"."id" as "categoriaId", "categoria"."nome" as "categoria", 
            extract(month from "data") as "mes", sum("valor") as "valor"
      from movimentacao
      join subcategoria on "movimentacao"."subcategoriaId" = "subcategoria"."id"
      join categoria on "subcategoria"."categoriaId" = "categoria"."id"
      where "tipo_movId" = 1 and extract(year from "data") = ${ano}
      group by "categoria"."id", extract(month from "data")
    `;

    const entradaCategorias = await sequelize.query(entradaCategoriasSql, {
      raw: true,
      type: Sequelize.QueryTypes.SELECT,
    });

    const categoriasEntrada = await formatarCategoria(entradaCategorias, ano);

    const investimentoCategoriasSql = `
    select "categoria"."id" as "categoriaId", "categoria"."nome" as "categoria", 
            extract(month from "data") as "mes", sum("valor") as "valor"
      from movimentacao
      join subcategoria on "movimentacao"."subcategoriaId" = "subcategoria"."id"
      join categoria on "subcategoria"."categoriaId" = "categoria"."id"
      where "tipo_movId" = 3 and extract(year from "data") = ${ano}
      group by "categoria"."id", extract(month from "data")
    `;

    const investimentoCategorias = await sequelize.query(
      investimentoCategoriasSql,
      {
        raw: true,
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const categoriasInvestimento = await formatarCategoria(
      investimentoCategorias,
      ano
    );

    const saidaCategoriasSql = `
    select "categoria"."id" as "categoriaId", "categoria"."nome" as "categoria", 
            extract(month from "data") as "mes", sum("valor") as "valor"
      from movimentacao
      join subcategoria on "movimentacao"."subcategoriaId" = "subcategoria"."id"
      join categoria on "subcategoria"."categoriaId" = "categoria"."id"
      where "tipo_movId" = 2 and extract(year from "data") = ${ano}
      group by "categoria"."id", extract(month from "data")
    `;

    const saidaCategorias = await sequelize.query(saidaCategoriasSql, {
      raw: true,
      type: Sequelize.QueryTypes.SELECT,
    });

    const categoriasSaida = await formatarCategoria(saidaCategorias, ano);

    const entradaTotalAnualSql = `
      select sum(valor) from movimentacao
      where "tipo_movId" = 1 and extract(year from data) = ${ano}
    `;

    const entradaTotalAnual = await sequelize.query(entradaTotalAnualSql, {
      raw: true,
      type: Sequelize.QueryTypes.SELECT,
    });

    const saidaTotalAnualSql = `
      select sum(valor) from movimentacao
      where "tipo_movId" = 2 and extract(year from data) = ${ano}
    `;

    const saidaTotalAnual = await sequelize.query(saidaTotalAnualSql, {
      raw: true,
      type: Sequelize.QueryTypes.SELECT,
    });

    const investimentoTotalAnualSql = `
      select sum(valor) from movimentacao
      where "tipo_movId" = 3 and extract(year from data) = ${ano}
    `;

    const investimentoTotalAnual = await sequelize.query(
      investimentoTotalAnualSql,
      {
        raw: true,
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const totalMensalSql = `
      select extract(month from data) as mes, tipos_mov.nome, sum(valor) as valor, "Colors"."color" from movimentacao
      join tipos_mov on "movimentacao"."tipo_movId" = "tipos_mov"."id"
      join "Colors" on "Colors"."tabRef" = 'tipos_mov' and "tipos_mov"."id" = "Colors"."regId"
      where extract(year from data) = ${ano}
      group by extract(year from data), extract(month from data), tipos_mov.nome, "Colors"."color"
    `;

    const totalMensal = await sequelize.query(totalMensalSql, {
      raw: true,
      type: Sequelize.QueryTypes.SELECT,
    });

    const totalMensalFormatado = await formatarTotalMensal(totalMensal);

    // // Remover
    // console.log("Sleep pra simular tempo resposta da api. REMOVER PLZ");
    // await sleep(2000);
    // // Remover

    res.status(200).json({
      totalAnual: [
        {
          nome: "Entradas",
          valor: entradaTotalAnual[0]["sum"] || "0",
        },
        {
          nome: "Investimentos",
          valor: investimentoTotalAnual[0]["sum"] || "0",
        },
        {
          nome: "Saídas",
          valor: saidaTotalAnual[0]["sum"] || "0",
        },
        {
          nome: "Saldo",
          valor: (
            Math.floor(
              (parseFloat(entradaTotalAnual[0]["sum"] || "0") -
                parseFloat(investimentoTotalAnual[0]["sum"] || "0") -
                parseFloat(saidaTotalAnual[0]["sum"] || "0")) *
                100
            ) / 100
          ).toString(),
        },
      ],
      totalMensal: totalMensalFormatado,
      movimentos: [
        {
          tipoMovimento: "Entrada",
          categorias: categoriasEntrada,
        },
        {
          tipoMovimento: "Investimento",
          categorias: categoriasInvestimento,
        },
        {
          tipoMovimento: "Saída",
          categorias: categoriasSaida,
        },
      ],
    });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

module.exports = router;

const formatarTotalMensal = async (totalMensal) => {
  let meses = [];

  for (i = 0; i < 12; i++) {
    meses[i] = [];
    totalMensal.map((mes) => {
      if (mes.mes - 1 === i) {
        meses[i].push({
          title: mes.nome,
          value: parseFloat(mes.valor),
          color: mes.color,
        });
      }
    });
  }

  meses = meses.map((mes) => {
    let valorEntrada = 0;
    let valorSaida = 0;
    let valorInvestimento = 0;

    mes.map((mov) => {
      if (mov.title === "Entrada") {
        valorEntrada += mov.value;
      }
      if (mov.title === "Saída") {
        valorSaida += mov.value;
      }
      if (mov.title === "Investimento") {
        valorInvestimento += mov.value;
      }
    });

    return mes.map((mov) => {
      if (mov.title === "Entrada") {
        mov.title = "Saldo";
        mov.value = valorEntrada - (valorSaida + valorInvestimento);
      }
      return mov;
    });
  });

  return meses;
};

const formatarCategoria = async (categoriaEntradas, ano) => {
  const categorias = [];

  // Adicionar categorias e array com valor mensal total por categoria
  categoriaEntradas.map((categoria) => {
    let categoriaAchouIndice = categorias.findIndex(
      (categ) => categ.categoria === categoria.categoria
    );
    if (categoriaAchouIndice >= 0) {
      categorias[categoriaAchouIndice].total[categoria.mes - 1] =
        categoria.valor;
    } else {
      categorias.push({
        categoria: categoria.categoria,
        id: categoria.categoriaId,
        total: ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
        subcategorias: [],
      });

      let categoriaAchouIndice = categorias.findIndex(
        (categ) => categ.categoria === categoria.categoria
      );

      categorias[categoriaAchouIndice].total[categoria.mes - 1] =
        categoria.valor;
    }
  });

  for (var i = 0; i < categorias.length; i++) {
    const categoria = categorias[i];
    const subcategoriasCategoriaSql = `
        select "subcategoria"."id" as "subcategoriaId", "subcategoria"."nome" as "subcategoria", 
                extract(month from "data") as "mes", sum("valor") as "valor"
          from movimentacao
          join subcategoria on "movimentacao"."subcategoriaId" = "subcategoria"."id"
          where "subcategoria"."categoriaId" = ${categoria.id} and extract(year from "data") = ${ano}
          group by "subcategoria"."id", extract(month from "data")
      `;

    const subcategoriasCategoria = await sequelize.query(
      subcategoriasCategoriaSql,
      {
        raw: true,
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    // Adicionar subcategoria e array com valor mensal total por subcategoria
    subcategoriasCategoria.map((subcategoria) => {
      let subcategoriaAchouIndice = categorias[i].subcategorias.findIndex(
        (subCateg) => subCateg.subcategoria === subcategoria.subcategoria
      );
      if (subcategoriaAchouIndice >= 0) {
        categorias[i].subcategorias[subcategoriaAchouIndice].total[
          subcategoria.mes - 1
        ] = subcategoria.valor;
      } else {
        categorias[i].subcategorias.push({
          subcategoria: subcategoria.subcategoria,
          id: subcategoria.subcategoriaId,
          total: ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
        });

        let subcategoriaAchouIndice = categorias[i].subcategorias.findIndex(
          (subCateg) => subCateg.subcategoria === subcategoria.subcategoria
        );

        categorias[i].subcategorias[subcategoriaAchouIndice].total[
          subcategoria.mes - 1
        ] = subcategoria.valor;
      }
    });
  }

  return categorias;
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
