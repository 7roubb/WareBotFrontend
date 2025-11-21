import { useEffect, useState } from 'react';
import { Plus, Package, Edit, Trash2, Upload, X, DollarSign, Box } from 'lucide-react';
import { products } from '../services/api';

export default function Products() {
  const [productList, setProductList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    quantity: 0,
    category: '',
    brand: '',
    price: 0,
    description: '',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await products.list();
    setProductList(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await products.update(editingProduct.id, formData);
      } else {
        await products.create(formData);
      }
      loadProducts();
      closeModal();
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product?')) {
      await products.delete(id);
      loadProducts();
    }
  };

  const handleImageUpload = async (productId: string, file: File) => {
    try {
      await products.uploadImage(productId, file);
      loadProducts();
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const openModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        category: product.category || '',
        brand: product.brand || '',
        price: product.price || 0,
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        quantity: 0,
        category: '',
        brand: '',
        price: 0,
        description: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Products</h1>
          <p className="text-accent-400">Manage inventory and product details</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {productList.map((product) => (
          <div
            key={product.id}
            className="group bg-gradient-card rounded-xl border border-accent-700 shadow-neo-md overflow-hidden hover:border-primary-500 hover:shadow-neo transition duration-300"
          >
            {/* Image */}
            <div className="relative h-48 bg-accent-800 flex items-center justify-center overflow-hidden">
              {product.main_image_url || product.image_urls?.[0] ? (
                <img
                  src={product.main_image_url || product.image_urls[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <Package className="w-16 h-16 text-accent-600" />
              )}
              <label className="absolute top-3 right-3 p-2 rounded-lg bg-accent-800/80 hover:bg-accent-700 cursor-pointer transition border border-accent-600">
                <Upload className="w-4 h-4 text-primary-400" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(product.id, file);
                  }}
                />
              </label>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-bold text-white truncate mb-1">{product.name}</h3>
              <p className="text-xs text-accent-500 mb-4">SKU: {product.sku}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent-400 flex items-center">
                    <Box className="w-3 h-3 mr-1" /> Stock
                  </span>
                  <span className="font-bold text-primary-300">{product.quantity}</span>
                </div>

                {product.price && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-accent-400 flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" /> Price
                    </span>
                    <span className="font-bold text-accent-200">${product.price.toFixed(2)}</span>
                  </div>
                )}

                {product.category && (
                  <div className="mt-3 pt-2 border-t border-accent-700">
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary-500/20 text-primary-300 border border-primary-500/30">
                      {product.category}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => openModal(product)}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 border border-primary-500/30 text-xs font-semibold transition flex items-center justify-center"
                >
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-xs font-semibold transition flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-card rounded-2xl shadow-neo max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-accent-700">
            <div className="sticky top-0 bg-accent-800/80 backdrop-blur text-white p-6 flex items-center justify-between border-b border-accent-700">
              <h2 className="text-2xl font-bold flex items-center">
                <Package className="w-6 h-6 mr-3 text-primary-400" />
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-accent-700 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-accent-200 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-accent-200 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-accent-800/50 border border-accent-700 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition placeholder-accent-500"
                  placeholder="Enter product description"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-yellow text-accent-900 py-3 rounded-lg font-bold shadow-neo hover:shadow-neo-lg transition"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-accent-700/50 text-accent-300 rounded-lg font-semibold hover:bg-accent-700 transition border border-accent-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
