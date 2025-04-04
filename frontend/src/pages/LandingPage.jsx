import React from 'react';
import { MessageSquare, Book, Award, Users, ArrowRight, Check, MessageCircle } from 'lucide-react';

const LandingPage = () => {
  const features = [
    {
      icon: <MessageSquare className="h-10 w-10 text-green-500" />,
      title: 'Trò chuyện thông minh',
      description: 'Tương tác tự nhiên với hệ thống trí tuệ nhân tạo được huấn luyện đặc biệt để hiểu và trả lời các câu hỏi về chính sách người có công.'
    },
    {
      icon: <Book className="h-10 w-10 text-green-500" />,
      title: 'Thông tin chính xác',
      description: 'Dữ liệu được tổng hợp từ các văn bản pháp luật chính thức về chính sách ưu đãi người có công với cách mạng.'
    },
    {
      icon: <Award className="h-10 w-10 text-green-500" />,
      title: 'Cập nhật liên tục',
      description: 'Hệ thống được cập nhật thường xuyên theo các chính sách mới nhất, đảm bảo thông tin luôn chính xác và đáp ứng nhu cầu người dùng.'
    },
    {
      icon: <Users className="h-10 w-10 text-green-500" />,
      title: 'Hỗ trợ mọi đối tượng',
      description: 'Thiết kế thân thiện, dễ sử dụng với mọi đối tượng người dùng, không cần kiến thức chuyên môn về công nghệ.'
    }
  ];

  const benefits = [
    'Tiếp cận thông tin chính sách một cách nhanh chóng',
    'Xác định chính xác quyền lợi và thủ tục cần thiết',
    'Tiết kiệm thời gian tìm kiếm qua nhiều văn bản pháp luật',
    'Thuận tiện sử dụng mọi lúc, mọi nơi',
    'Không cần kiến thức chuyên môn về luật',
    'Dữ liệu được cập nhật liên tục theo quy định mới nhất'
  ];

  const faqs = [
    {
      question: 'Chatbot này hoạt động như thế nào?',
      answer: 'Chatbot sử dụng công nghệ RAG (Retrieval Augmented Generation) kết hợp với mô hình ngôn ngữ lớn để truy xuất thông tin chính xác từ cơ sở dữ liệu văn bản pháp luật về người có công, sau đó tạo ra câu trả lời phù hợp với câu hỏi của người dùng.'
    },
    {
      question: 'Thông tin do chatbot cung cấp có chính xác không?',
      answer: 'Chatbot truy xuất thông tin từ nguồn dữ liệu chính thức về chính sách người có công. Tuy nhiên, kết quả chỉ mang tính chất tham khảo và người dùng nên xác minh với cơ quan chức năng cho các quyết định quan trọng.'
    },
    {
      question: 'Tôi có phải trả phí để sử dụng chatbot này không?',
      answer: 'Không, chatbot này hoàn toàn miễn phí. Đây là sản phẩm từ đồ án tốt nghiệp nhằm hỗ trợ cộng đồng tiếp cận thông tin về chính sách người có công.'
    },
    {
      question: 'Chatbot có thể hỗ trợ những thông tin gì?',
      answer: 'Chatbot có thể cung cấp thông tin về các chế độ ưu đãi, trợ cấp, quy trình thủ tục hành chính, và quyền lợi dành cho người có công với cách mạng và thân nhân của họ.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-2">
                <span className="text-xl font-bold text-green-700">CongChat</span>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">Tính năng</a>
              <a href="#benefits" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">Lợi ích</a>
              <a href="#faq" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium">Hỏi đáp</a>
            </nav>
            <div className="flex items-center space-x-4">
              <a href="/login" className="text-green-600 hover:text-green-800 px-3 py-2 rounded-md text-sm font-medium">Đăng nhập</a>
              <a href="/register" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">Đăng ký</a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-600 to-green-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2 space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Chatbot Hỗ Trợ Chính Sách Người Có Công
              </h1>
              <p className="text-lg md:text-xl text-green-100">
                Tra cứu thông tin chính sách dễ dàng thông qua trò chuyện thông minh. Tiếp cận thông tin chính xác về quyền lợi và thủ tục dành cho người có công với cách mạng.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <a 
                  href="/register" 
                  className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-6 rounded-md shadow-lg hover:bg-green-50 transition-colors"
                >
                  Bắt đầu ngay
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
                <a 
                  href="/chat-demo" 
                  className="inline-flex items-center justify-center bg-green-700 text-white font-bold py-3 px-6 rounded-md shadow-lg border border-green-400 hover:bg-green-800 transition-colors"
                >
                  Dùng thử
                </a>
              </div>
            </div>
            <div className="md:w-1/2 mt-8 md:mt-0">
              <div className="bg-white p-4 rounded-lg shadow-xl">
                <div className="bg-gray-100 rounded-lg p-3 mb-3">
                  <div className="flex space-x-2 mb-1">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="bg-white rounded p-4 shadow-sm">
                    <div className="flex flex-col space-y-4">
                      <div className="flex justify-end">
                        <div className="bg-green-100 text-green-800 p-3 rounded-lg max-w-xs">
                          Tôi muốn biết về mức trợ cấp hàng tháng cho thương binh hạng 1/4 theo quy định mới nhất
                        </div>
                      </div>
                      <div className="flex">

                        <div className="bg-white text-gray-800 p-3 rounded-lg max-w-xs shadow-sm">
                        Theo quy định mới nhất tại Nghị định 55/2023/NĐ-CP có hiệu lực từ ngày 05/09/2023, mức trợ cấp hàng tháng cho thương binh hạng 1/4 (tỷ lệ tổn thương cơ thể 81-100%) dao động từ 5.335.000 đồng đến 6.589.000 đồng tùy theo tỷ lệ thương tật chính xác.
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-green-100 text-green-800 p-3 rounded-lg max-w-xs">
                          Ngoài trợ cấp hàng tháng, thương binh hạng 1/4 còn được hưởng những ưu đãi gì?
                        </div>
                      </div>
                      <div className="flex">
                        <div className="bg-white text-gray-800 p-3 rounded-lg max-w-xs shadow-sm">
                          Ngoài trợ cấp hàng tháng, thương binh hạng 1/4 còn được hưởng các chế độ ưu đãi như: phụ cấp thêm 1.031.000đ/tháng, trợ cấp người phục vụ, ưu đãi giáo dục, y tế, nhà ở, điều dưỡng phục hồi sức khỏe định kỳ, và miễn giảm một số loại thuế, phí theo quy định.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Tính năng nổi bật</h2>
            <p className="mt-4 text-xl text-gray-600">Công nghệ hiện đại kết hợp với dữ liệu đáng tin cậy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Cách Thức Hoạt Động</h2>
            <p className="mt-4 text-xl text-gray-600">Đơn giản, hiệu quả và đáng tin cậy</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Đặt câu hỏi</h3>
              <p className="text-gray-600">Nhập câu hỏi của bạn về chính sách người có công vào chatbot một cách tự nhiên, như đang trò chuyện với chuyên gia.</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Xử lý thông minh</h3>
              <p className="text-gray-600">Hệ thống sử dụng công nghệ RAG để tìm kiếm thông tin chính xác từ cơ sở dữ liệu văn bản pháp luật.</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Nhận câu trả lời</h3>
              <p className="text-gray-600">Nhận được câu trả lời rõ ràng, dễ hiểu với tham chiếu đến các văn bản pháp luật chính thức.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-16 bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Lợi ích khi sử dụng</h2>
            <p className="mt-4 text-xl text-gray-600">Tiếp cận thông tin nhanh chóng và chính xác</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="ml-3 text-gray-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Câu hỏi thường gặp</h2>
            <p className="mt-4 text-xl text-gray-600">Giải đáp thắc mắc của bạn</p>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-gray-200">
            {faqs.map((faq, index) => (
              <div key={index} className="py-6">
                <h3 className="text-lg font-medium text-gray-900">{faq.question}</h3>
                <p className="mt-3 text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Sẵn sàng trải nghiệm?</h2>
          <p className="text-xl mb-8 text-green-100">
            Bắt đầu sử dụng Chatbot Hỗ Trợ Chính Sách Người Có Công ngay hôm nay
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/register"
              className="inline-flex items-center justify-center bg-white text-green-700 font-bold py-3 px-8 rounded-md shadow-lg hover:bg-green-50 transition-colors"
            >
              Đăng ký tài khoản
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center bg-green-600 text-white font-bold py-3 px-8 rounded-md shadow-lg border border-green-500 hover:bg-green-800 transition-colors"
            >
              Đăng nhập
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center">
                <MessageCircle className="h-8 w-8 text-green-400" />
                <span className="ml-2 text-xl font-bold text-white">ChatNCC</span>
              </div>
              <p className="mt-4 max-w-xs text-gray-400">
                Chatbot hỗ trợ tra cứu thông tin về chính sách người có công với cách mạng.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Truy cập nhanh</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#features" className="text-gray-400 hover:text-white">Tính năng</a></li>
                  <li><a href="#benefits" className="text-gray-400 hover:text-white">Lợi ích</a></li>
                  <li><a href="#faq" className="text-gray-400 hover:text-white">Hỏi đáp</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tài nguyên</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Hướng dẫn sử dụng</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Văn bản pháp luật</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Thư viện</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pháp lý</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white">Điều khoản sử dụng</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white">Chính sách bảo mật</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-12 border-t border-gray-800 pt-8">
            <p className="text-gray-400 text-sm text-center">
              © 2024 Chatbot Hỗ Trợ Chính Sách Người Có Công. Bản quyền thuộc về đồ án tốt nghiệp CNTT.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;