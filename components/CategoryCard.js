// components/CategoryCard.js
const CategoryCard = ({ category }) => {
  return (
    <div className="bg-green-800 text-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold">{category.name}</h3>
      <p className="text-gray-200 mt-2">{category.description}</p>
    </div>
  );
};

export default CategoryCard;
